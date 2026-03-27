from fastapi import APIRouter, HTTPException, Request, Response
from deps import db, get_current_user, get_session_token, sanitize_picture, generate_family_code, send_email_async, send_push_notification, check_geofences, ADMIN_EMAIL
from deps import User, Family, Chore, ShoppingItem, FamilyWallPost, Message, Event, ReadingLog, Reward, CheckIn, FirebaseAuthRequest
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import uuid
import json
import logging
import httpx
import re
import os
import base64
import hashlib

router = APIRouter()

# ============== Family Management ==============

@router.post("/family/create")
async def create_family(request: Request, data: dict):
    """Create a new family (parent account creation)"""
    current_user = await get_current_user(request)
    
    family_name = data.get('family_name', f"{current_user.get('name', 'My')}'s Family")
    
    # Check if user already belongs to a family
    if current_user.get('family_id'):
        raise HTTPException(status_code=400, detail="You already belong to a family")
    
    # Generate unique family code
    family_code = generate_family_code()
    while await db.families.find_one({"family_code": family_code}):
        family_code = generate_family_code()
    
    family_id = f"family_{uuid.uuid4().hex[:12]}"
    family_doc = {
        "family_id": family_id,
        "family_code": family_code,
        "family_name": family_name,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "settings": {}
    }
    await db.families.insert_one(family_doc)
    
    # Update user to be parent of this family
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "family_id": family_id,
            "parent_id": current_user['user_id'],  # Parent's parent_id is themselves
            "role": "parent"
        }}
    )
    
    return {
        "family_id": family_id,
        "family_code": family_code,
        "family_name": family_name,
        "message": "Family created successfully! Share the code with family members to join."
    }

@router.post("/family/join")
async def join_family(request: Request, data: dict):
    """Join an existing family using family code"""
    current_user = await get_current_user(request)
    
    family_code = data.get('family_code', '').strip().upper()
    role = data.get('role', 'member')  # child, member, or homehub (not parent during join)
    
    if not family_code:
        raise HTTPException(status_code=400, detail="Family code is required")
    
    if role not in ['child', 'member', 'homehub']:
        raise HTTPException(status_code=400, detail="Role must be 'child', 'member', or 'homehub'")
    
    # Check if user already belongs to a family
    if current_user.get('family_id'):
        raise HTTPException(status_code=400, detail="You already belong to a family")
    
    # Find family by code
    family = await db.families.find_one({"family_code": family_code}, {"_id": 0})
    if not family:
        raise HTTPException(status_code=404, detail="Invalid family code")
    
    # Find the parent user (creator) of the family
    parent_user = await db.users.find_one({"user_id": family['created_by']}, {"_id": 0})
    parent_id = parent_user['user_id'] if parent_user else family['created_by']
    
    # Update user to join this family
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {
            "family_id": family['family_id'],
            "parent_id": parent_id,
            "role": role
        }}
    )
    
    # Notify parents about new member
    parents = await db.users.find(
        {"family_id": family['family_id'], "role": "parent"},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    for parent in parents:
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": parent['user_id'],
            "type": "family_join",
            "title": "New Family Member",
            "message": f"{current_user.get('name', 'Someone')} joined your family as a {role}",
            "data": {"new_member_id": current_user['user_id'], "role": role},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return {
        "family_id": family['family_id'],
        "family_name": family['family_name'],
        "role": role,
        "message": f"Successfully joined {family['family_name']}!"
    }

@router.get("/family/info")
async def get_family_info(request: Request):
    """Get family information including family code"""
    current_user = await get_current_user(request)
    
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    
    # For legacy users without family_id, try to find by parent_id pattern
    family = await db.families.find_one({"family_id": family_id}, {"_id": 0})
    
    if not family:
        # Create family for legacy parent users
        if current_user['role'] == 'parent':
            family_code = generate_family_code()
            while await db.families.find_one({"family_code": family_code}):
                family_code = generate_family_code()
            
            family = {
                "family_id": family_id,
                "family_code": family_code,
                "family_name": f"{current_user.get('name', 'My')}'s Family",
                "created_by": current_user['user_id'],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "settings": {}
            }
            await db.families.insert_one(family)
            
            # Update user's family_id
            await db.users.update_one(
                {"user_id": current_user['user_id']},
                {"$set": {"family_id": family_id}}
            )
        else:
            return {"error": "No family found", "family_code": None}
    
    # Get member count
    member_count = await db.users.count_documents({
        "$or": [{"family_id": family_id}, {"parent_id": family_id}]
    })
    
    return {
        "family_id": family['family_id'],
        "family_code": family['family_code'] if current_user['role'] == 'parent' else None,
        "family_name": family['family_name'],
        "member_count": member_count,
        "created_at": family['created_at']
    }

@router.get("/family/members/detailed")
async def get_family_members_detailed(request: Request):
    """Get detailed family members list for management UI"""
    current_user = await get_current_user(request)
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    
    members = await db.users.find(
        {"$or": [{"family_id": family_id}, {"parent_id": family_id}, {"user_id": family_id}]},
        {"_id": 0}
    ).to_list(100)
    
    # Sanitize and enhance member data
    for member in members:
        member['picture'] = sanitize_picture(member.get('picture'))
        member['is_current_user'] = member['user_id'] == current_user['user_id']
    
    # Sort: parents first, then by name
    members.sort(key=lambda x: (0 if x.get('role') == 'parent' else 1, x.get('name', '')))
    
    return {"members": members, "total": len(members)}

@router.put("/family/members/{member_id}/role")
async def update_member_role(member_id: str, request: Request, data: dict):
    """Update a family member's role (parent only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can change member roles")
    
    new_role = data.get('role')
    if new_role not in ['parent', 'member', 'child', 'homehub']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be parent, member, child, or homehub")
    
    # Get the member
    member = await db.users.find_one({"user_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Verify member belongs to same family through multiple checks
    current_user_id = current_user['user_id']
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user_id)
    current_family_id = current_user.get('current_family_id')
    
    member_family = member.get('family_id') or member.get('parent_id') or member.get('current_family_id')
    
    # Check direct family link
    is_same_family = (
        member_family == family_id or
        member.get('user_id') == family_id or
        member.get('parent_id') == current_user_id
    )
    
    # Also check via family_memberships (shared real family)
    if not is_same_family and current_family_id:
        shared_membership = await db.family_memberships.find_one({
            "family_id": current_family_id,
            "user_id": member_id
        })
        if shared_membership:
            is_same_family = True
    
    # Also check if both are in ANY common family via memberships
    if not is_same_family:
        my_families = await db.family_memberships.find(
            {"user_id": current_user_id}, {"_id": 0, "family_id": 1}
        ).to_list(20)
        my_family_ids = {m['family_id'] for m in my_families}
        my_family_ids.add(family_id)
        
        member_families = await db.family_memberships.find(
            {"user_id": member_id}, {"_id": 0, "family_id": 1}
        ).to_list(20)
        for mf in member_families:
            if mf['family_id'] in my_family_ids:
                is_same_family = True
                break
    
    if not is_same_family:
        raise HTTPException(status_code=403, detail="Member does not belong to your family")
    
    # Update role in users collection
    await db.users.update_one(
        {"user_id": member_id},
        {"$set": {"role": new_role}}
    )
    
    # Also update role in family_memberships
    if current_family_id:
        await db.family_memberships.update_many(
            {"user_id": member_id, "family_id": current_family_id},
            {"$set": {"role": new_role}}
        )
    
    # Notify the member about role change
    if member_id != current_user['user_id']:
        notification_doc = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": member_id,
            "type": "role_change",
            "title": "Role Updated",
            "message": f"Your role has been changed to {new_role}",
            "data": {"new_role": new_role, "changed_by": current_user['user_id']},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification_doc)
    
    return {"success": True, "new_role": new_role}

@router.delete("/family/members/{member_id}")
async def remove_family_member(member_id: str, request: Request):
    """Remove a member from the family (parent only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can remove members")
    
    # Can't remove yourself
    if member_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the family")
    
    # Get the member
    member = await db.users.find_one({"user_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Verify member belongs to same family
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    member_family = member.get('family_id') or member.get('parent_id')
    
    if member_family != family_id:
        raise HTTPException(status_code=403, detail="Member does not belong to your family")
    
    # Remove from family
    await db.users.update_one(
        {"user_id": member_id},
        {"$unset": {"family_id": "", "parent_id": ""}, "$set": {"role": "member"}}
    )
    
    # Notify the removed member
    notification_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": member_id,
        "type": "family_removed",
        "title": "Removed from Family",
        "message": "You have been removed from the family",
        "data": {"removed_by": current_user['user_id']},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"success": True, "message": "Member removed from family"}

@router.post("/family/invite")
async def send_family_invite(request: Request, data: dict):
    """Send an invite link/code to join the family"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can send invites")
    
    # Get family info
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    family = await db.families.find_one({"family_id": family_id}, {"_id": 0})
    
    if not family:
        # Create family if doesn't exist
        family_code = generate_family_code()
        family = {
            "family_id": family_id,
            "family_code": family_code,
            "family_name": f"{current_user.get('name', 'My')}'s Family",
            "created_by": current_user['user_id'],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "settings": {}
        }
        await db.families.insert_one(family)
    
    invite_message = data.get('message', '')
    
    return {
        "family_code": family['family_code'],
        "family_name": family['family_name'],
        "invite_text": f"Join {family['family_name']} on FamFocus Hub! Use code: {family['family_code']}\n\n{invite_message}".strip()
    }

@router.put("/family/name")
async def update_family_name(request: Request, data: dict):
    """Update the family name (parent only)"""
    current_user = await get_current_user(request)
    
    if current_user['role'] != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can update family name")
    
    new_name = data.get('family_name', '').strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Family name is required")
    
    family_id = current_user.get('family_id') or current_user.get('parent_id', current_user['user_id'])
    
    await db.families.update_one(
        {"family_id": family_id},
        {"$set": {"family_name": new_name}}
    )
    
    return {"success": True, "family_name": new_name}

# ============== End Family Management ==============

# ==================== MULTIPLE FAMILY SUPPORT ====================

@router.get("/families")
async def get_user_families(request: Request):
    """Get all families the user belongs to"""
    current_user = await get_current_user(request)
    user_id = current_user['user_id']
    current_family_id = current_user.get('current_family_id')
    user_role = current_user.get('role')
    
    families = []
    seen_family_ids = set()
    
    # For parent-role users: add the virtual family if they have children or a family doc
    if user_role == 'parent':
        child_count = await db.users.count_documents({"parent_id": user_id})
        saved_family = await db.families.find_one({"family_id": user_id}, {"_id": 0})
        
        if child_count > 0 or saved_family:
            family_name = (saved_family or {}).get('name') or (saved_family or {}).get('family_name') or current_user.get('family_name', f"{current_user['name']}'s Family")
            families.append({
                "family_id": user_id,
                "name": family_name,
                "family_code": (saved_family or {}).get('family_code', ''),
                "role": "parent",
                "member_count": child_count + 1,
                "is_current": current_family_id == user_id or (not current_family_id and True)
            })
            seen_family_ids.add(user_id)
    
    # For all roles: resolve family via family_id or parent_id on the user doc
    linked_family_id = current_user.get('family_id') or current_user.get('parent_id')
    if linked_family_id and linked_family_id not in seen_family_ids:
        linked_family = await db.families.find_one({"family_id": linked_family_id}, {"_id": 0})
        if linked_family:
            member_count = await db.family_memberships.count_documents({"family_id": linked_family_id})
            parent_children = await db.users.count_documents({"parent_id": linked_family_id})
            is_current = linked_family_id == current_family_id or (not current_family_id and len(families) == 0)
            families.append({
                "family_id": linked_family_id,
                "name": linked_family.get('name', linked_family.get('family_name', 'Family')),
                "family_code": linked_family.get('family_code', ''),
                "role": user_role or 'member',
                "member_count": member_count + parent_children,
                "is_current": is_current
            })
            seen_family_ids.add(linked_family_id)
    
    # Check family memberships
    memberships = await db.family_memberships.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(20)
    
    for membership in memberships:
        if membership['family_id'] in seen_family_ids:
            continue
        family = await db.families.find_one(
            {"family_id": membership['family_id']},
            {"_id": 0}
        )
        if family:
            member_count = await db.family_memberships.count_documents({"family_id": family['family_id']})
            parent_children = await db.users.count_documents({"parent_id": family['family_id']})
            is_current = family['family_id'] == current_family_id or (not current_family_id and len(families) == 0)
            families.append({
                "family_id": family['family_id'],
                "name": family.get('name', family.get('family_name', 'Family')),
                "family_code": family.get('family_code', ''),
                "role": membership.get('role', 'member'),
                "member_count": member_count + parent_children,
                "is_current": is_current
            })
            seen_family_ids.add(family['family_id'])
    
    # Ensure exactly one family is marked current
    if families and not any(f['is_current'] for f in families):
        for f in families:
            if f['family_id'] == current_family_id:
                f['is_current'] = True
                break
        else:
            families[0]['is_current'] = True
    
    return {"families": families}

@router.post("/families")
async def create_new_family(request: Request, data: dict):
    """Create a new family"""
    current_user = await get_current_user(request)
    
    family_id = f"family_{uuid.uuid4().hex[:12]}"
    family_name = data.get('name', f"{current_user['name']}'s Family")
    
    family_doc = {
        "family_id": family_id,
        "name": family_name,
        "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.families.insert_one(family_doc)
    
    # Add creator as parent
    membership_doc = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "family_id": family_id,
        "user_id": current_user['user_id'],
        "role": "parent",
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_memberships.insert_one(membership_doc)
    
    return {"family_id": family_id, "name": family_name}

@router.post("/families/{family_id}/invite")
async def invite_to_family(family_id: str, request: Request, data: dict):
    """Invite someone to join a family — sends email if configured, always returns invite code"""
    current_user = await get_current_user(request)
    
    # Check if user has permission to invite
    membership = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": current_user['user_id'],
        "role": {"$in": ["admin", "parent"]}
    })
    
    if not membership and current_user['user_id'] != family_id:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")
    
    invite_email = data.get('email', '').strip()
    invite_role = data.get('role', 'member')
    
    # Get or create family with code
    family = await db.families.find_one({"family_id": family_id}, {"_id": 0})
    if not family:
        family_code = generate_family_code()
        family = {
            "family_id": family_id,
            "name": f"{current_user.get('name', 'My')}'s Family",
            "family_code": family_code,
            "created_by": current_user['user_id'],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.families.insert_one(family)
    elif not family.get('family_code'):
        family_code = generate_family_code()
        await db.families.update_one({"family_id": family_id}, {"$set": {"family_code": family_code}})
        family['family_code'] = family_code
    
    invite_doc = {
        "invite_id": f"inv_{uuid.uuid4().hex[:12]}",
        "family_id": family_id,
        "email": invite_email,
        "role": invite_role,
        "invited_by": current_user['user_id'],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_invites.insert_one(invite_doc)
    
    family_name = family.get('name', family.get('family_name', 'Our Family'))
    family_code = family.get('family_code', '')
    
    # Try to send email if configured
    email_status = "not_sent"
    if invite_email:
        html = f"""
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#0f172a;border-radius:16px;color:#fff;">
            <h2 style="margin:0 0 16px;">You're invited to join {family_name}!</h2>
            <p style="color:#94a3b8;">{current_user['name']} has invited you to join their family on FamFocus Hub as a <strong>{invite_role}</strong>.</p>
            <div style="background:#1e293b;border-radius:12px;padding:16px;margin:16px 0;text-align:center;">
                <p style="color:#94a3b8;margin:0 0 8px;font-size:14px;">Your family code:</p>
                <p style="font-size:28px;font-weight:900;color:#6366f1;margin:0;letter-spacing:4px;">{family_code}</p>
            </div>
            <p style="color:#64748b;font-size:13px;">Enter this code in FamFocus Hub to join the family.</p>
        </div>
        """
        result = await send_email_async(invite_email, f"Join {family_name} on FamFocus Hub!", html)
        email_status = result.get('status', 'error')
    
    return {
        "invite_id": invite_doc['invite_id'],
        "status": "pending",
        "family_code": family_code,
        "family_name": family_name,
        "email_status": email_status
    }

@router.post("/families/switch/{family_id}")
async def switch_family(family_id: str, request: Request):
    """Switch to a different family"""
    current_user = await get_current_user(request)
    
    # Verify membership
    membership = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": current_user['user_id']
    })
    
    is_parent = current_user['user_id'] == family_id
    
    if not membership and not is_parent:
        raise HTTPException(status_code=403, detail="Not a member of this family")
    
    # Update current family
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"current_family_id": family_id}}
    )
    
    return {"success": True, "current_family_id": family_id}

@router.get("/families/invites/pending")
async def get_pending_invites(request: Request):
    """Get pending invites for current user"""
    current_user = await get_current_user(request)
    email = current_user.get('email')
    
    invites = await db.family_invites.find(
        {"email": email, "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    # Get family details for each invite
    for invite in invites:
        family = await db.families.find_one(
            {"family_id": invite['family_id']},
            {"_id": 0}
        )
        if family:
            invite['family_name'] = family.get('name', 'Unknown Family')
        else:
            # If family_id is user_id (parent's family)
            parent = await db.users.find_one({"user_id": invite['family_id']}, {"_id": 0})
            if parent:
                invite['family_name'] = parent.get('family_name', f"{parent.get('name')}'s Family")
    
    return {"invites": invites}

@router.post("/families/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, request: Request):
    """Accept a family invitation"""
    current_user = await get_current_user(request)
    
    invite = await db.family_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite['email'] != current_user.get('email'):
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    if invite['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    # Create membership
    membership_doc = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "family_id": invite['family_id'],
        "user_id": current_user['user_id'],
        "role": invite.get('role', 'member'),
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    await db.family_memberships.insert_one(membership_doc)
    
    # Update invite status
    await db.family_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "family_id": invite['family_id']}

# Resolve family by invite code (public — no auth required for lookup)
@router.get("/families/join/{family_code}")
async def resolve_family_code(family_code: str):
    """Look up a family by its invite code. Returns family name for preview."""
    family = await db.families.find_one({"family_code": family_code}, {"_id": 0})
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return {
        "family_id": family['family_id'],
        "family_name": family.get('name', family.get('family_name', 'A Family')),
        "family_code": family_code
    }

# Join family by invite code (auth required)
@router.post("/families/join/{family_code}")
async def join_family_by_code(family_code: str, request: Request):
    """Join a family using an invite code. Properly migrates user into the family."""
    current_user = await get_current_user(request)
    
    family = await db.families.find_one({"family_code": family_code}, {"_id": 0})
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    family_id = family['family_id']
    user_id = current_user['user_id']
    
    # Check if already a member
    existing = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": user_id
    })
    if existing or user_id == family_id:
        # Still update current_family_id so they switch context
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"current_family_id": family_id}}
        )
        return {"success": True, "family_id": family_id, "already_member": True}
    
    # Determine role — check if there's a pending invite with a specific role
    invite = await db.family_invites.find_one({
        "family_id": family_id,
        "email": current_user.get('email', ''),
        "status": "pending"
    })
    join_role = invite['role'] if invite else current_user.get('role', 'member')
    
    # Create membership
    membership_doc = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "family_id": family_id,
        "user_id": user_id,
        "role": join_role,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "joined_via": "invite_code"
    }
    await db.family_memberships.insert_one(membership_doc)
    
    # Update user: set current_family_id and parent_id if joining a parent's family
    update_fields = {"current_family_id": family_id}
    
    # If the family_id is a user_id (virtual family), set parent_id for child roles
    if join_role == 'child':
        parent_user = await db.users.find_one({"user_id": family_id}, {"_id": 0})
        if parent_user and parent_user.get('role') == 'parent':
            update_fields["parent_id"] = family_id
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_fields})
    
    # Mark invite as accepted
    if invite:
        await db.family_invites.update_one(
            {"invite_id": invite['invite_id']},
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    family_name = family.get('name', family.get('family_name', 'Family'))
    return {
        "success": True,
        "family_id": family_id,
        "family_name": family_name,
        "role": join_role,
        "already_member": False
    }

@router.post("/families/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, request: Request):
    """Decline a family invitation"""
    current_user = await get_current_user(request)
    
    invite = await db.family_invites.find_one({"invite_id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite['email'] != current_user.get('email'):
        raise HTTPException(status_code=403, detail="This invite is not for you")
    
    await db.family_invites.update_one(
        {"invite_id": invite_id},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True}

@router.delete("/families/{family_id}/leave")
async def leave_family(family_id: str, request: Request):
    """Leave a family"""
    current_user = await get_current_user(request)
    
    # Can't leave own family as parent
    if current_user['user_id'] == family_id:
        raise HTTPException(status_code=400, detail="Cannot leave your own family")
    
    result = await db.family_memberships.delete_one({
        "family_id": family_id,
        "user_id": current_user['user_id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    # If this was current family, switch to primary
    if current_user.get('current_family_id') == family_id:
        await db.users.update_one(
            {"user_id": current_user['user_id']},
            {"$unset": {"current_family_id": ""}}
        )
    
    return {"success": True}

# Edit family name
@router.put("/families/{family_id}")
async def update_family(family_id: str, request: Request, data: dict):
    """Update family details (name). Handles both real and virtual families."""
    current_user = await get_current_user(request)
    
    new_name = data.get('name', '').strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Family name is required")
    
    # Check if this is a "virtual" family (family_id = parent's user_id)
    family = await db.families.find_one({"family_id": family_id})
    
    if family:
        # Real family — check permissions
        if family.get('created_by') != current_user['user_id']:
            membership = await db.family_memberships.find_one({
                "family_id": family_id,
                "user_id": current_user['user_id'],
                "role": {"$in": ["parent", "admin"]}
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Only parents can edit family")
        
        await db.families.update_one(
            {"family_id": family_id},
            {"$set": {"name": new_name, "family_name": new_name}}
        )
    else:
        # Virtual family — the family_id IS the parent's user_id
        if current_user['user_id'] != family_id and current_user.get('role') != 'parent':
            raise HTTPException(status_code=403, detail="Only parents can edit family")
        
        # Create the family document so it persists
        family_code = generate_family_code()
        await db.families.insert_one({
            "family_id": family_id,
            "name": new_name,
            "family_name": new_name,
            "family_code": family_code,
            "created_by": current_user['user_id'],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Also update user's family_name field
    await db.users.update_one(
        {"user_id": current_user['user_id']},
        {"$set": {"family_name": new_name}}
    )
    
    return {"success": True, "name": new_name}

# Delete family
@router.delete("/families/{family_id}")
async def delete_family(family_id: str, request: Request):
    """Delete a family (only by creator/admin)"""
    current_user = await get_current_user(request)
    
    family = await db.families.find_one({"family_id": family_id})
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    if family.get('created_by') != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Only the family creator can delete it")
    
    # Delete all related data
    await db.families.delete_one({"family_id": family_id})
    await db.family_memberships.delete_many({"family_id": family_id})
    await db.family_invites.delete_many({"family_id": family_id})
    
    # Update users who had this as current family
    await db.users.update_many(
        {"current_family_id": family_id},
        {"$unset": {"current_family_id": ""}}
    )
    
    return {"success": True}

# Get family members
@router.get("/families/{family_id}/members")
async def get_family_members(family_id: str, request: Request):
    """Get all members of a family"""
    current_user = await get_current_user(request)
    
    # Check if this is a "virtual" family (family_id = parent's user_id)
    family = await db.families.find_one({"family_id": family_id})
    is_virtual_family = family is None
    
    if is_virtual_family:
        # Virtual family: family_id is the parent's user_id
        # Allow: the parent, their children, or any user linked via family_id/parent_id
        is_authorized = (
            current_user['user_id'] == family_id or
            current_user.get('parent_id') == family_id or
            current_user.get('family_id') == family_id
        )
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Not a member of this family")
        
        members = []
        # Add the parent
        parent = await db.users.find_one({"user_id": family_id}, {"_id": 0, "password_hash": 0})
        if parent:
            members.append({
                "user_id": parent['user_id'],
                "name": parent.get('name', 'Unknown'),
                "email": parent.get('email', ''),
                "role": "parent",
                "picture": parent.get('picture'),
                "username": parent.get('username'),
                "has_pin": bool(parent.get('pin')),
                "online_status": parent.get('online_status', False)
            })
        
        # Add all children under this parent
        children = await db.users.find(
            {"parent_id": family_id},
            {"_id": 0, "password_hash": 0}
        ).to_list(50)
        
        for child in children:
            members.append({
                "user_id": child['user_id'],
                "name": child.get('name', 'Unknown'),
                "email": child.get('email', ''),
                "role": child.get('role', 'child'),
                "picture": child.get('picture'),
                "username": child.get('username'),
                "has_pin": bool(child.get('pin')),
                "online_status": child.get('online_status', False)
            })
        
        return {"members": members}
    
    # Real family: use family_memberships
    membership = await db.family_memberships.find_one({
        "family_id": family_id,
        "user_id": current_user['user_id']
    })
    
    is_family_owner = family.get('created_by') == current_user['user_id']
    is_linked = (
        current_user.get('family_id') == family_id or
        current_user.get('parent_id') == family_id
    )
    
    if not membership and not is_family_owner and not is_linked:
        raise HTTPException(status_code=403, detail="Not a member of this family")
    
    memberships = await db.family_memberships.find(
        {"family_id": family_id},
        {"_id": 0}
    ).to_list(100)
    
    members = []
    for m in memberships:
        user = await db.users.find_one({"user_id": m['user_id']}, {"_id": 0, "password_hash": 0})
        if user:
            members.append({
                "user_id": m['user_id'],
                "name": user.get('name', 'Unknown'),
                "email": user.get('email', ''),
                "role": "parent" if m.get('role') == 'admin' else m.get('role', 'member'),
                "picture": user.get('picture'),
                "username": user.get('username'),
                "has_pin": bool(user.get('pin')),
                "online_status": user.get('online_status', False)
            })
    
    # Also add family creator if not already in memberships
    creator_id = family.get('created_by')
    if creator_id and not any(m['user_id'] == creator_id for m in members):
        creator = await db.users.find_one({"user_id": creator_id}, {"_id": 0, "password_hash": 0})
        if creator:
            members.append({
                "user_id": creator_id,
                "name": creator.get('name', 'Unknown'),
                "email": creator.get('email', ''),
                "role": "parent",
                "picture": creator.get('picture'),
                "username": creator.get('username'),
                "has_pin": bool(creator.get('pin')),
                "online_status": creator.get('online_status', False)
            })
    
    # Also include users linked via parent_id or family_id (virtual family members)
    existing_ids = {m['user_id'] for m in members}
    linked_users = await db.users.find(
        {"$or": [{"parent_id": family_id}, {"family_id": family_id}]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    for linked in linked_users:
        if linked['user_id'] not in existing_ids:
            members.append({
                "user_id": linked['user_id'],
                "name": linked.get('name', 'Unknown'),
                "email": linked.get('email', ''),
                "role": linked.get('role', 'child'),
                "picture": linked.get('picture'),
                "username": linked.get('username'),
                "has_pin": bool(linked.get('pin')),
                "online_status": linked.get('online_status', False)
            })
            existing_ids.add(linked['user_id'])
    
    # For real families created by a parent, also include that parent's children
    if family and family.get('created_by'):
        creator_id = family['created_by']
        creator_children = await db.users.find(
            {"parent_id": creator_id},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        for child in creator_children:
            if child['user_id'] not in existing_ids:
                members.append({
                    "user_id": child['user_id'],
                    "name": child.get('name', 'Unknown'),
                    "email": child.get('email', ''),
                    "role": child.get('role', 'child'),
                    "picture": child.get('picture'),
                    "username": child.get('username'),
                    "has_pin": bool(child.get('pin')),
                    "online_status": child.get('online_status', False)
                })
                existing_ids.add(child['user_id'])
    
    return {"members": members}

# Change member role
@router.put("/families/{family_id}/members/{member_id}/role")
async def change_member_role(family_id: str, member_id: str, request: Request, data: dict):
    """Change a member's role in the family"""
    current_user = await get_current_user(request)
    
    # Check if current user is parent/admin
    family = await db.families.find_one({"family_id": family_id})
    is_family_owner = family and family.get('created_by') == current_user['user_id']
    
    if not is_family_owner:
        membership = await db.family_memberships.find_one({
            "family_id": family_id,
            "user_id": current_user['user_id'],
            "role": {"$in": ["parent", "admin"]}
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Only parents can change roles")
    
    new_role = data.get('role')
    if new_role not in ['child', 'member', 'parent']:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Can't change own role
    if member_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    # Update the member's role
    result = await db.family_memberships.update_one(
        {"family_id": family_id, "user_id": member_id},
        {"$set": {"role": new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Also update the user's role if they're in the main users collection
    await db.users.update_one(
        {"user_id": member_id, "parent_id": family_id},
        {"$set": {"role": new_role}}
    )
    
    return {"success": True}

# Remove member from family
@router.delete("/families/{family_id}/members/{member_id}")
async def delete_family_member(family_id: str, member_id: str, request: Request):
    """Remove a member from the family"""
    current_user = await get_current_user(request)
    
    # Check if current user is parent/admin
    family = await db.families.find_one({"family_id": family_id})
    is_family_owner = family and family.get('created_by') == current_user['user_id']
    
    if not is_family_owner:
        membership = await db.family_memberships.find_one({
            "family_id": family_id,
            "user_id": current_user['user_id'],
            "role": {"$in": ["parent", "admin"]}
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Only parents can remove members")
    
    # Can't remove yourself
    if member_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    
    # Can't remove family creator
    if family and family.get('created_by') == member_id:
        raise HTTPException(status_code=400, detail="Cannot remove family creator")
    
    result = await db.family_memberships.delete_one({
        "family_id": family_id,
        "user_id": member_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Update user's current family if needed
    await db.users.update_one(
        {"user_id": member_id, "current_family_id": family_id},
        {"$unset": {"current_family_id": ""}}
    )
    
    return {"success": True}

# ==================== WELCOME TUTORIAL ====================

