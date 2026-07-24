/**
 * VSocial — OAuth 2.0 (Google + Apple)
 */
import { getDb } from './db.js';
import { createSession } from './auth.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function getGoogleAuthUrl(clientId, redirectUri) {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'offline',
		prompt: 'consent'
	});
	return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(code, clientId, clientSecret, redirectUri) {
	const res = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	if (!res.ok) throw new Error('Google token exchange failed: ' + res.status);
	return res.json();
}

export async function getGoogleProfile(accessToken) {
	const res = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error('Google profile fetch failed');
	return res.json();
}

export async function handleGoogleOAuth(code, origin) {
	const db = getDb();
	const clientId = db
		.prepare("SELECT value FROM system_settings WHERE key = 'oauth_google_client_id'")
		.get()?.value;
	const clientSecret = db
		.prepare("SELECT value FROM system_settings WHERE key = 'oauth_google_client_secret'")
		.get()?.value;

	if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

	const redirectUri = `${origin}/api/auth/oauth/google/callback`;
	const tokens = await exchangeGoogleCode(code, clientId, clientSecret, redirectUri);
	const profile = await getGoogleProfile(tokens.access_token);

	const existing = db
		.prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_uid = ?')
		.get('google', profile.id);

	let userId;
	if (existing) {
		userId = existing.user_id;
		db.prepare(
			'UPDATE oauth_accounts SET access_token = ?, refresh_token = ? WHERE provider = ? AND provider_uid = ?'
		).run(tokens.access_token, tokens.refresh_token || null, 'google', profile.id);
	} else {
		const emailMatch = db.prepare('SELECT id FROM users WHERE email = ?').get(profile.email);
		if (emailMatch) {
			userId = emailMatch.id;
		} else {
			const bcrypt = await import('bcryptjs');
			const randomPass = await bcrypt.hash(Math.random().toString(36).slice(-16), 10);
			const username =
				profile.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') +
				'_' +
				Date.now().toString(36).slice(-4);
			const result = db
				.prepare(
					"INSERT INTO users (username, email, password_hash, display_name, avatar_url, email_verified, role) VALUES (?, ?, ?, ?, ?, 1, 'user')"
				)
				.run(
					username,
					profile.email,
					randomPass,
					profile.name || username,
					profile.picture || null
				);
			userId = Number(result.lastInsertRowid);
			db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'user')").run(userId);
			db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
		}
		db.prepare(
			'INSERT INTO oauth_accounts (user_id, provider, provider_uid, email, display_name, avatar_url, access_token, refresh_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		).run(
			userId,
			'google',
			profile.id,
			profile.email,
			profile.name,
			profile.picture,
			tokens.access_token,
			tokens.refresh_token || null
		);
	}

	const token = createSession(userId, new Request(origin));
	const user = db
		.prepare(
			`
		SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.cover_url,
			u.bio, u.category, u.is_verified, u.wallet_balance, u.follower_count, u.following_count,
			COALESCE(ur.role, u.role, 'user') AS role
		FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? LIMIT 1
	`
		)
		.get(userId);

	return { token, user };
}
