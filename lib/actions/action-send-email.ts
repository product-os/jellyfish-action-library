import { defaultEnvironment } from '@balena/jellyfish-environment';
import mail from '@balena/jellyfish-mail';
import type { SendEmailOptions } from '@balena/jellyfish-mail';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { Contract } from '@balena/jellyfish-types/build/core';

const MAIL_OPTIONS = defaultEnvironment.mail.options || {
	domain: '',
};

/**
 * @summary Build and return send email request options.
 * @function
 *
 * @param userCard - user to send email to
 * @param subject - email subject
 * @param html - email body HTML
 * @returns send email request options
 */
export function buildSendEmailOptions(
	userCard: Contract,
	subject: string,
	html: string,
): SendEmailOptions {
	let userEmail = userCard.data.email;
	if (Array.isArray(userEmail)) {
		userEmail = userEmail[0];
	}

	return {
		fromAddress: `no-reply@${MAIL_OPTIONS.domain}`,
		toAddress: userEmail as string,
		subject,
		html,
	};
}

const handler: ActionFile['handler'] = async (
	_session,
	_context,
	_card,
	request,
) => {
	const { fromAddress, toAddress, subject, html } = request.arguments;

	if (mail) {
		const response = await mail.sendEmail({
			toAddress,
			fromAddress,
			subject,
			html,
		});
		return response;
	} else {
		throw new Error('Mail integration not found');
	}
};

export const actionSendEmail: ActionFile = {
	handler,
	card: {
		slug: 'action-send-email',
		type: 'action@1.0.0',
		name: 'Send email',
		data: {
			arguments: {
				toAddress: {
					type: 'string',
					format: 'email',
				},
				fromAddress: {
					type: 'string',
					format: 'email',
				},
				subject: {
					type: 'string',
				},
				html: {
					type: 'string',
				},
			},
		},
	},
};
