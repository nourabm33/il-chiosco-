import { z } from "zod";
import { config } from "../config.js";
import { badRequest } from "../lib/errors.js";

export const itemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
      notes: z.string().trim().max(200).optional(),
    }),
  )
  .max(config.maxOrderItems);

export function parse(schema, value, message = "Invalid request") {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(message, parsed.error.flatten());
  return parsed.data;
}

const uuid = z.string().uuid();
export const orderId = (req) => parse(uuid, req.params.id, "Invalid order id");
