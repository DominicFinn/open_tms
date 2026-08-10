import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

const RESULTS_PER_TYPE = 5;
const MIN_QUERY_LENGTH = 2;

// Powers the top AppBar search box. Fans a single query out across the
// entities users actually look up by hand (shipments/orders by reference
// number, carriers/customers by name) instead of making them open each
// list page and filter manually.
export async function globalSearchRoutes(server: FastifyInstance) {
  await registerOrgScope(server);

  server.get('/api/v1/search', {
    schema: {
      tags: ['Search'],
      summary: 'Global search across shipments, orders, carriers, and customers',
      description:
        'Case-insensitive substring match on reference numbers and names, scoped to the current org. Returns up to 5 results per entity type.',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { q } = (req.query as { q?: string }) || {};
    const term = (q || '').trim();
    const empty = { shipments: [], orders: [], carriers: [], customers: [] };
    if (term.length < MIN_QUERY_LENGTH) {
      return { data: empty, error: null };
    }

    const orgId = req.orgId!;
    const contains = { contains: term, mode: 'insensitive' as const };

    const [shipments, orders, carriers, customers] = await Promise.all([
      server.prisma.shipmentReadModel.findMany({
        where: { orgId, OR: [{ reference: contains }, { proNumber: contains }] },
        select: { id: true, reference: true, status: true, customerName: true },
        take: RESULTS_PER_TYPE,
        orderBy: { createdAt: 'desc' },
      }),
      server.prisma.orderReadModel.findMany({
        where: { orgId, OR: [{ orderNumber: contains }, { poNumber: contains }] },
        select: { id: true, orderNumber: true, poNumber: true, status: true, customerName: true },
        take: RESULTS_PER_TYPE,
        orderBy: { orderNumber: 'desc' },
      }),
      server.prisma.carrier.findMany({
        where: {
          orgId,
          deletedAt: null,
          OR: [{ name: contains }, { mcNumber: contains }, { dotNumber: contains }],
        },
        select: { id: true, name: true, mcNumber: true, archived: true },
        take: RESULTS_PER_TYPE,
        orderBy: { name: 'asc' },
      }),
      server.prisma.customer.findMany({
        where: { orgId, name: contains },
        select: { id: true, name: true, contactEmail: true, archived: true },
        take: RESULTS_PER_TYPE,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { data: { shipments, orders, carriers, customers }, error: null };
  });
}
