# Test Credentials

## Parent Account
- Email: zhesterusar@gmail.com
- Role: parent
- Login: POST /api/auth/dev-login {"email":"zhesterusar@gmail.com","role":"parent"}
- Returns: session_token

## Co-Parent (Elizabeth)
- Email: ebuss980@gmail.com
- Role: parent
- Login: POST /api/auth/dev-login {"email":"ebuss980@gmail.com","role":"parent"}

## HomeHub
- Email: ikh.mrnugget@gmail.com
- Role: homehub
- Login: POST /api/auth/dev-login {"email":"ikh.mrnugget@gmail.com","role":"homehub"}

## Children
- Eli, Jeremiah, Nivea (created via family management)

## Notes
- All dev-login endpoints return session_token (not "token")
- Store session_token in localStorage as 'dev_session_token'
- Do NOT store dev_user in localStorage (too large with base64 picture)
