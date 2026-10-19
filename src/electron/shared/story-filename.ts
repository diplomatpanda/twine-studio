import {Story} from '../../store/stories/stories.types';

/**
 * Returns a filename for a story object that's guaranteed to be safe across all
 * platforms. For this, we use POSIX's definition
 * (http://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_276)
 * with the addition of spaces, for legibility.
 */
export function storyFileName(story: Pick<Story, 'name'>, extension = '.html') {
	return story.name.replace(/[^\w. -]/g, '_') + extension;
}

/** Compare library names as they would collide on a case-insensitive disk. */
export function storyFileNameKey(story: Pick<Story, 'name'>) {
	return storyFileName(story).toLowerCase();
}
