import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IPendingLaneRequestsRepository } from '../repositories/PendingLaneRequestsRepository.js';
import { container, TOKENS } from '../di/index.js';

export async function pendingLaneRequestRoutes(server: FastifyInstance) {
  const pendingRequestsRepo = container.resolve<IPendingLaneRequestsRepository>(TOKENS.IPendingLaneRequestsRepository);

  // Get all pending lane requests
  server.get('/api/v1/pending-lane-requests', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const requests = await pendingRequestsRepo.all();
    return { data: requests, error: null };
  });

  // Get pending lane requests by status
  server.get('/api/v1/pending-lane-requests/status/:status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { status } = req.params as { status: string };

    if (!['pending', 'approved', 'rejected', 'lane_created'].includes(status)) {
      reply.code(400);
      return { data: null, error: 'Invalid status. Must be one of: pending, approved, rejected, lane_created' };
    }

    const requests = await pendingRequestsRepo.findByStatus(status);
    return { data: requests, error: null };
  });

  // Get single pending lane request
  server.get('/api/v1/pending-lane-requests/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const request = await pendingRequestsRepo.findById(id);
    if (!request) {
      reply.code(404);
      return { data: null, error: 'Pending lane request not found' };
    }

    return { data: request, error: null };
  });

  // Approve pending lane request
  server.post('/api/v1/pending-lane-requests/:id/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      resolvedById: z.string().optional(),
      notes: z.string().optional()
    }).parse((req as any).body);

    try {
      const request = await pendingRequestsRepo.findById(id);
      if (!request) {
        reply.code(404);
        return { data: null, error: 'Pending lane request not found' };
      }

      if (request.status !== 'pending') {
        reply.code(400);
        return { data: null, error: `Cannot approve request with status: ${request.status}` };
      }

      const updated = await pendingRequestsRepo.approve(
        id,
        body.resolvedById || 'system',
        body.notes
      );

      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to approve request' };
    }
  });

  // Reject pending lane request
  server.post('/api/v1/pending-lane-requests/:id/reject', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      resolvedById: z.string().optional(),
      notes: z.string().optional()
    }).parse((req as any).body);

    try {
      const request = await pendingRequestsRepo.findById(id);
      if (!request) {
        reply.code(404);
        return { data: null, error: 'Pending lane request not found' };
      }

      if (request.status !== 'pending') {
        reply.code(400);
        return { data: null, error: `Cannot reject request with status: ${request.status}` };
      }

      const updated = await pendingRequestsRepo.reject(
        id,
        body.resolvedById || 'system',
        body.notes
      );

      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to reject request' };
    }
  });

  // Mark as lane created
  server.post('/api/v1/pending-lane-requests/:id/mark-lane-created', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      laneId: z.string().uuid()
    }).parse((req as any).body);

    try {
      const request = await pendingRequestsRepo.findById(id);
      if (!request) {
        reply.code(404);
        return { data: null, error: 'Pending lane request not found' };
      }

      const updated = await pendingRequestsRepo.markAsLaneCreated(id, body.laneId);

      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'Failed to mark lane as created' };
    }
  });
}
