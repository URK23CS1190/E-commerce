const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const loginCounter = new client.Counter({
  name: 'ecommerce_customer_logins_total',
  help: 'Total number of customer logins'
});

const trafficCounter = new client.Counter({
  name: 'ecommerce_page_requests_total',
  help: 'Total page requests',
  labelNames: ['route', 'method', 'status_code']
});

const activeUsersGauge = new client.Gauge({
  name: 'ecommerce_active_users',
  help: 'Currently active users'
});

register.registerMetric(loginCounter);
register.registerMetric(trafficCounter);
register.registerMetric(activeUsersGauge);

module.exports = {
  register,
  loginCounter,
  trafficCounter,
  activeUsersGauge
};