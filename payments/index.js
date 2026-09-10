import { registerMenuRoutes } from './menu.js';
import { registerFlowRoutes } from './flow.js';
import { registerPaymentsAdminRoutes } from './admin.js';

export function registerPaymentsModule(bot) {
  registerMenuRoutes(bot);
  registerFlowRoutes(bot);
  registerPaymentsAdminRoutes(bot);
}

export * from './session.js';
export * from './service.js';
export * from './keyboard.js';
export * from './menu.js';
export * from './flow.js';
export * from './admin.js';
