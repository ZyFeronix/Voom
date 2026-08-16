/**
 * Svelte Action: clickOutside
 * Triggers callback when a click happens outside the specified element.
 */
export function clickOutside(node, callback) {
	const handleClick = (event) => {
		if (node && !node.contains(event.target) && !event.defaultPrevented) {
			if (typeof callback === 'function') {
				callback(event);
			} else {
				node.dispatchEvent(new CustomEvent('outclick'));
			}
		}
	};

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
}
