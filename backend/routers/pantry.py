from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from deps import db, get_current_user
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import base64
import tempfile

router = APIRouter()

PANTRY_CATEGORIES = [
    {"id": "fridge", "name": "Fridge", "icon": "thermometer"},
    {"id": "freezer", "name": "Freezer", "icon": "snowflake"},
    {"id": "shelf", "name": "Pantry Shelf", "icon": "archive"},
    {"id": "spices", "name": "Spices & Seasonings", "icon": "flame"},
    {"id": "beverages", "name": "Beverages", "icon": "cup"},
    {"id": "produce", "name": "Fresh Produce", "icon": "leaf"},
    {"id": "other", "name": "Other", "icon": "box"}
]

# ==================== PANTRY CRUD ====================

@router.get("/pantry")
async def get_pantry(request: Request, category: Optional[str] = None):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    query = {"family_id": family_id}
    if category:
        query["category"] = category
    
    items = await db.pantry.find(query, {"_id": 0}).sort("category", 1).to_list(500)
    
    # Check for expiring items
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    soon = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    
    expiring_soon = []
    expired = []
    low_stock = []
    
    for item in items:
        exp = item.get('expiration_date')
        if exp:
            if exp < today:
                expired.append(item)
            elif exp <= soon:
                expiring_soon.append(item)
        if item.get('low_stock'):
            low_stock.append(item)
    
    return {
        "items": items,
        "categories": PANTRY_CATEGORIES,
        "alerts": {
            "expired": len(expired),
            "expiring_soon": len(expiring_soon),
            "low_stock": len(low_stock)
        }
    }

@router.post("/pantry")
async def add_pantry_item(request: Request, data: dict):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    item_id = f"pantry_{uuid.uuid4().hex[:12]}"
    item_doc = {
        "item_id": item_id,
        "family_id": family_id,
        "name": data.get('name', '').strip(),
        "category": data.get('category', 'shelf'),
        "quantity": data.get('quantity', ''),
        "unit": data.get('unit', ''),
        "expiration_date": data.get('expiration_date'),
        "low_stock": False,
        "added_by": current_user['user_id'],
        "added_by_name": current_user.get('name', 'Unknown'),
        "source": data.get('source', 'manual'),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pantry.insert_one(item_doc)
    return await db.pantry.find_one({"item_id": item_id}, {"_id": 0})

@router.post("/pantry/bulk")
async def add_pantry_items_bulk(request: Request, data: dict):
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    items_data = data.get('items', [])
    added = []
    for item in items_data:
        item_id = f"pantry_{uuid.uuid4().hex[:12]}"
        item_doc = {
            "item_id": item_id,
            "family_id": family_id,
            "name": item.get('name', '').strip(),
            "category": item.get('category', 'shelf'),
            "quantity": item.get('quantity', ''),
            "unit": item.get('unit', ''),
            "expiration_date": item.get('expiration_date'),
            "low_stock": False,
            "added_by": current_user['user_id'],
            "added_by_name": current_user.get('name', 'Unknown'),
            "source": item.get('source', 'scanner'),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pantry.insert_one(item_doc)
        result = await db.pantry.find_one({"item_id": item_id}, {"_id": 0})
        added.append(result)
    
    return {"items": added, "added": len(added), "message": f"{len(added)} items added to pantry"}

@router.put("/pantry/{item_id}")
async def update_pantry_item(item_id: str, request: Request, data: dict):
    await get_current_user(request)
    
    update_fields = {}
    for field in ['name', 'category', 'quantity', 'unit', 'expiration_date', 'low_stock']:
        if field in data:
            update_fields[field] = data[field]
    
    if update_fields:
        update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.pantry.update_one({"item_id": item_id}, {"$set": update_fields})
    
    updated = await db.pantry.find_one({"item_id": item_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated

@router.delete("/pantry/{item_id}")
async def delete_pantry_item(item_id: str, request: Request):
    await get_current_user(request)
    result = await db.pantry.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item removed from pantry"}

@router.put("/pantry/{item_id}/low-stock")
async def toggle_low_stock(item_id: str, request: Request):
    current_user = await get_current_user(request)
    item = await db.pantry.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    new_status = not item.get('low_stock', False)
    await db.pantry.update_one({"item_id": item_id}, {"$set": {"low_stock": new_status}})
    
    # If marked as low stock, auto-add to shopping list
    if new_status:
        family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
        existing = await db.shopping_items.find_one({
            "family_id": family_id,
            "name": {"$regex": f"^{item['name']}$", "$options": "i"},
            "status": {"$in": ["approved", "pending"]}
        })
        if not existing:
            shop_item_id = f"item_{uuid.uuid4().hex[:12]}"
            await db.shopping_items.insert_one({
                "item_id": shop_item_id,
                "family_id": family_id,
                "name": item['name'],
                "requested_by": current_user['user_id'],
                "requested_by_name": current_user.get('name', 'Pantry'),
                "status": "approved",
                "source": "pantry_low_stock",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"low_stock": new_status, "message": "Added to shopping list" if new_status else "Removed low stock flag"}

# ==================== PANTRY CHECK (for Dinner Planner) ====================

@router.post("/pantry/check")
async def check_pantry_ingredients(request: Request, data: dict):
    """Check which ingredients are already in the pantry"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    ingredients = data.get('ingredients', [])
    pantry_items = await db.pantry.find({"family_id": family_id}, {"_id": 0, "name": 1}).to_list(500)
    pantry_names = [p['name'].lower() for p in pantry_items]
    
    results = []
    for ingredient in ingredients:
        ing_lower = ingredient.lower().strip()
        in_pantry = any(pn in ing_lower or ing_lower in pn for pn in pantry_names)
        results.append({
            "ingredient": ingredient,
            "in_pantry": in_pantry
        })
    
    return {"results": results}

# ==================== SHOPPING → PANTRY SYNC ====================

@router.post("/pantry/from-shopping/{item_id}")
async def move_shopping_to_pantry(item_id: str, request: Request, data: dict = None):
    """Move a purchased shopping item to the pantry"""
    current_user = await get_current_user(request)
    family_id = current_user.get('parent_id', current_user.get('family_id', current_user['user_id']))
    
    shopping_item = await db.shopping_items.find_one({"item_id": item_id}, {"_id": 0})
    if not shopping_item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    
    # Add to pantry
    pantry_id = f"pantry_{uuid.uuid4().hex[:12]}"
    category = (data or {}).get('category', 'shelf')
    await db.pantry.insert_one({
        "item_id": pantry_id,
        "family_id": family_id,
        "name": shopping_item['name'],
        "category": category,
        "quantity": (data or {}).get('quantity', ''),
        "unit": (data or {}).get('unit', ''),
        "expiration_date": (data or {}).get('expiration_date'),
        "low_stock": False,
        "added_by": current_user['user_id'],
        "added_by_name": current_user.get('name', 'Unknown'),
        "source": "shopping_list",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Mark shopping item as purchased
    await db.shopping_items.update_one(
        {"item_id": item_id},
        {"$set": {"status": "purchased", "purchased_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"'{shopping_item['name']}' added to pantry", "pantry_item_id": pantry_id}

# ==================== AI RECEIPT/ITEM SCANNER ====================

@router.post("/pantry/scan")
async def scan_receipt_or_item(request: Request, data: dict):
    """Scan a receipt or product image using AI to extract items"""
    current_user = await get_current_user(request)
    
    image_base64 = data.get('image')
    scan_type = data.get('scan_type', 'receipt')
    
    if not image_base64:
        raise HTTPException(status_code=400, detail="Image data required")
    
    # Remove data URL prefix if present
    if ',' in image_base64:
        image_base64 = image_base64.split(',')[1]
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"scan_{uuid.uuid4().hex[:8]}",
            system_message="""You are a grocery and pantry item extraction assistant. 
            Analyze the image and extract food/grocery items. 
            Return ONLY a JSON array of objects with these fields:
            - name: item name (string)
            - category: one of 'fridge', 'freezer', 'shelf', 'spices', 'beverages', 'produce', 'other'
            - quantity: estimated quantity if visible (string, empty if unknown)
            Return ONLY the JSON array, no other text. Example:
            [{"name": "Whole Milk", "category": "fridge", "quantity": "1 gallon"}, {"name": "Rice", "category": "shelf", "quantity": "2 lbs"}]"""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        prompt_text = {
            'receipt': "Extract all grocery/food items from this receipt. Include quantities if visible.",
            'product': "Identify this food product. What is it and what category does it belong in?",
            'shelf': "Identify all food items visible on this shelf or in this photo."
        }.get(scan_type, "Extract all food/grocery items from this image.")
        
        response = await chat.send_message(UserMessage(
            text=prompt_text,
            file_contents=[image_content]
        ))
        
        # Parse the response
        import json
        response_text = response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('\n', 1)[1]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
        
        items = json.loads(response_text)
        if not isinstance(items, list):
            items = [items]
        
        return {"items": items, "count": len(items), "scan_type": scan_type}
    
    except json.JSONDecodeError:
        return {"items": [], "count": 0, "error": "Could not parse items from image", "raw": response_text[:200] if 'response_text' in dir() else ''}
    except Exception as e:
        error_msg = str(e)
        if 'balance' in error_msg.lower() or 'credit' in error_msg.lower():
            raise HTTPException(status_code=402, detail="AI credits low. Go to Profile > Universal Key > Add Balance")
        raise HTTPException(status_code=500, detail=f"Scanner error: {error_msg[:100]}")
