import * as os from 'os';
import * as path from 'path';

export const SERVER_DIR = path.join(os.homedir(), '.pixel-agents');
export const SERVER_CONFIG_PATH = path.join(SERVER_DIR, 'server.json');
export const MAX_BODY_BYTES = 65536;
export const PROVIDER_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
export const SHUTDOWN_TIMEOUT_MS = 5000;
export const SERVER_REQUEST_TIMEOUT_MS = 10000;