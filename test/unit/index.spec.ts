import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import ActionLibrary from '../../lib/index';

const context = {
	id: 'jellyfish-action-library-test',
};

test('should return a set of actions', () => {
	const actionLibrary = new ActionLibrary();
	const actions = actionLibrary.getActions(context);
	expect(isPlainObject(actions)).toBeTruthy();
	expect(isEmpty(actions)).toBeFalsy();
	expect(typeof actions['action-create-card'].handler).toBe('function');
});
