import Database from 'better-sqlite3';
const db = new Database('d:/Vsocial/database.sqlite');
console.log('Checking DB connection...', !!db);
try {
	const posts = db
		.prepare(
			`
    SELECT p.*, p.body as content, u.username 
    FROM posts p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.deleted_at IS NULL AND u.is_active = 1 AND u.is_banned = 0 
    AND p.id IN (SELECT post_id FROM post_hashtags WHERE tag_name = ?) 
    ORDER BY p.like_count DESC, p.id DESC LIMIT 20
`
		)
		.all('test');
	console.log('Posts with #test:', posts.length);
	if (posts.length > 0) {
		console.log(
			posts.map((p) => ({ id: p.id, user_id: p.user_id, privacy: p.privacy, content: p.content }))
		);
	}
} catch (e) {
	console.error(e);
}
