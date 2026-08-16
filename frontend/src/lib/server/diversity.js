/**
 * VSocial — Feed Diversity Engine
 * Prevents clustering of content by the same creator.
 * Enforces maximum per-author quota and consecutive author limits.
 */

/**
 * Applies diversity filters to ranked candidates
 * @param {Array<object>} posts - Ranked post objects containing user_id
 * @param {number} [targetLimit=20] - Desired page size
 * @param {number} [maxPerAuthor=3] - Maximum posts from same creator per batch
 * @returns {Array<object>} Filtered and diversified post array
 */
export function applyDiversityFilters(posts, targetLimit = 20, maxPerAuthor = 3) {
	if (!Array.isArray(posts) || posts.length <= 1) return posts;

	const result = [];
	const authorCounts = new Map();
	let lastAuthor = null;
	let consecutiveCount = 0;

	for (const post of posts) {
		const authorId = post.user_id;
		const authorCount = authorCounts.get(authorId) || 0;

		// Rule 1: Max posts per author per page
		if (authorCount >= maxPerAuthor) {
			continue;
		}

		// Rule 2: Max 2 consecutive posts from same author
		if (authorId === lastAuthor) {
			consecutiveCount++;
			if (consecutiveCount >= 2) {
				continue;
			}
		} else {
			consecutiveCount = 1;
		}

		result.push(post);
		authorCounts.set(authorId, authorCount + 1);
		lastAuthor = authorId;

		if (result.length >= targetLimit) break;
	}

	return result;
}
