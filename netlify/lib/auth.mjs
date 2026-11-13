// Shared access check for every Media Tracker function.
//
// The app is private: each request must carry the passcode in the
// "x-app-key" header, and it must match the APP_PASSCODE environment
// variable set in Netlify.
//
// Fails closed: if APP_PASSCODE is not set, every request is refused,
// so nobody can spend API credit or write to Notion by accident.
import { timingSafeEqual, createHash } from 'node:crypto';

const json = (status, body) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

const digest = (value) => createHash('sha256').update(String(value)).digest();

// Returns a Response to send back when access is refused, or null when allowed.
export function checkAccess(request) {
    const expected = Netlify.env.get('APP_PASSCODE');

    if (!expected) {
        return json(503, {
            success: false,
            error: 'Locked: APP_PASSCODE is not set in Netlify, so all requests are refused.'
        });
    }

    const given = request.headers.get('x-app-key') || '';

    if (!given || !timingSafeEqual(digest(given), digest(expected))) {
        return json(401, { success: false, error: 'Wrong or missing passcode.' });
    }

    return null;
}
