import { registerPanelRoutes } from './panel.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerAdminsRoutes } from './admins.js';
import { registerUsersRoutes } from './users.js';
import { registerRedeemRoutes } from './redeem.js';

export function registerAdminModule(bot) {
  registerPanelRoutes(bot);
  registerDashboardRoutes(bot);
  registerAdminsRoutes(bot);
  registerUsersRoutes(bot);
  registerRedeemRoutes(bot);
}

export * from './panel.js';
export * from './dashboard.js';
export * from './admins.js';
export * from './users.js';
export * from './redeem.js';
