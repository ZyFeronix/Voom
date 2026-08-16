/**
 * VSocial — Creator & Identity Verification API
 *
 * GET  /api/verification/status?folio=XXX  — Check application status
 * GET  /api/verification/status            — Get authenticated user's active application
 * POST /api/verification/apply             — Submit creator verification application
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth, optionalAuth } from '$lib/server/auth.js';
import { sanitizeInput, validateEmail } from '$lib/server/security.js';
import crypto from 'crypto';

function generateFolio(category) {
	const year = new Date().getFullYear();
	const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
	const catCode = (category || 'CRE').substring(0, 3).toUpperCase();
	return `VS-VRF-${year}-${catCode}-${randomHex}`;
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || 'status';
	const db = getDb();

	if (action === 'status') {
		const folioQuery = url.searchParams.get('folio');
		if (folioQuery) {
			const req = await db
				.prepare(
					`SELECT folio, category, applicant_handle, status, created_at, reviewed_at
					 FROM verification_requests WHERE folio = ? LIMIT 1`
				)
				.get(folioQuery.trim().toUpperCase());

			if (!req) {
				return json({ error: 'Folio de verificación no encontrado' }, { status: 404 });
			}
			return json({ success: true, request: req });
		}

		// Authenticated user lookup
		const userId = await optionalAuth(request);
		if (!userId) {
			return json({ error: 'Folio no especificado o sesión requerida' }, { status: 400 });
		}

		const activeReq = await db
			.prepare(
				`SELECT * FROM verification_requests
				 WHERE user_id = ?
				 ORDER BY created_at DESC LIMIT 1`
			)
			.get(userId);

		return json({ success: true, request: activeReq || null });
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}

export async function POST({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const action = parts[0] || 'apply';
	const userId = await requireAuth(request);
	const db = getDb();

	if (action === 'apply') {
		const body = await request.json();

		const category = sanitizeInput(body.category || 'creator');
		const legalName = body.legal_name ? sanitizeInput(body.legal_name) : null;
		const applicantHandle = sanitizeInput(body.applicant_handle || body.handle || '');
		const contactEmail = (body.contact_email || body.email || '').trim();
		const specialty = body.specialty ? sanitizeInput(body.specialty) : null;
		const idDocumentUrl = body.id_document_url ? sanitizeInput(body.id_document_url) : null;

		if (!applicantHandle) {
			return json({ error: 'El nombre o handle de solicitante es requerido' }, { status: 400 });
		}

		if (!contactEmail || !validateEmail(contactEmail)) {
			return json({ error: 'Correo electrónico de contacto inválido' }, { status: 400 });
		}

		// Check if there is already a pending verification request for this user
		const existingPending = await db
			.prepare(
				`SELECT id, folio FROM verification_requests
				 WHERE user_id = ? AND status IN ('pending', 'reviewing') LIMIT 1`
			)
			.get(userId);

		if (existingPending) {
			return json(
				{
					error:
						'Ya tienes una solicitud de verificación en proceso con folio ' + existingPending.folio,
					folio: existingPending.folio,
					status: 'pending'
				},
				{ status: 409 }
			);
		}

		const portfolioLinksJson = body.portfolio_links
			? typeof body.portfolio_links === 'string'
				? body.portfolio_links
				: JSON.stringify(body.portfolio_links)
			: JSON.stringify([]);

		const socialLinksJson = body.social_links
			? typeof body.social_links === 'string'
				? body.social_links
				: JSON.stringify(body.social_links)
			: JSON.stringify({});

		const folio = generateFolio(category);

		await db
			.prepare(
				`INSERT INTO verification_requests (
					user_id, folio, category, legal_name, applicant_handle,
					contact_email, specialty, portfolio_links, social_links,
					id_document_url, status
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
			)
			.run(
				userId,
				folio,
				category,
				legalName,
				applicantHandle,
				contactEmail,
				specialty,
				portfolioLinksJson,
				socialLinksJson,
				idDocumentUrl
			);

		// Record activity
		await db
			.prepare(
				`INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, metadata)
				 VALUES (?, 'verification_apply', 'verification_request', (SELECT last_insert_rowid()), ?)`
			)
			.run(userId, JSON.stringify({ folio, category, handle: applicantHandle }))
			.catch(() => {});

		// Notify admins via socket if active
		if (globalThis.io) {
			globalThis.io.emit('new_admin_verification', { folio, category, handle: applicantHandle });
		}

		return json({
			success: true,
			folio,
			status: 'pending',
			message: 'Solicitud de verificación radicada exitosamente'
		});
	}

	return json({ error: 'Endpoint no encontrado' }, { status: 404 });
}
