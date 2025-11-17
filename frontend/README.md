# Bin Masud Kuku – Frontend Guide

This frontend is a React app (Create React App) for Bin Masud Kuku’s operations dashboard. It integrates with the Node/Express backend and supports editing, pagination, filters/search, and inventory constraints across modules.

## Standard list response shape

All paginated list endpoints return the same structure:

```json
{
  "data": [ /* array of rows */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 123,
    "pages": 7
  }
}
```

If an endpoint hasn’t been converted yet, it may return a plain array. The UI handles both, but new code should follow the `{ data, meta }` shape.

## Supported query params by module

These are accepted as query string parameters on GET list endpoints:

- Orders (`GET /orders`)
  - `page`, `limit`
  - `customer` (substring match)
  - `status` in: `pending|confirmed|fulfilled|cancelled`
  - `product_type` (matches order.product_type or linked product’s type)
  - `date_from`, `date_to` (inclusive; YYYY-MM-DD)

- Sales (`GET /sales`)
  - `page`, `limit`
  - `customer` (substring match)
  - `status` in: `Pending Delivery|Partial|Delivered`
  - `date_from`, `date_to` (inclusive; YYYY-MM-DD)

- Deliveries (`GET /deliveries`)
  - `page`, `limit`
  - `order_id` (exact)
  - `recipient` (substring match)
  - `date_from`, `date_to` (inclusive; YYYY-MM-DD)

- Mortalities (`GET /mortalities`)
  - `page`, `limit`
  - `search` (substring match on notes/batch if supported)
  - `date_from`, `date_to` (inclusive; YYYY-MM-DD)

- Feed usage (`GET /feeds/:id/usage`)
  - `page`, `limit`
  - `search` (substring match on notes/actor if supported)
  - `date_from`, `date_to` (inclusive; YYYY-MM-DD)

- Chicks (`GET /chicks`)
  - `page`, `limit`
  - `search` (batch name, breed, supplier)
  - `breed` (substring match)
  - `supplier` (substring match)
  - `date_from`, `date_to` (arrival_date range)

Notes:

- When filters change, the UI resets to page 1 and refetches.
- `limit` is capped at 100 server-side.

## Role-based restrictions

- Admin-only operations:
  - Delete destructive actions across modules (e.g., delete orders/deliveries/feeds/users).
  - Manage users (update/delete via `/users/:id`). Self-deletion is blocked to prevent lockout.

- Regular users:
  - Can view data and create/edit where permitted by module rules.
  - Authentication is via JWT; API requests include the token in `Authorization: Bearer <token>` (handled by the axios instance).

## Availability and safety constraints

These are enforced server-side (and assisted by client hints):

- Feed usage
  - Cannot consume more than the available stock for the selected feed. Updates/deletes adjust stock by delta so totals remain consistent.

- Deliveries
  - Over‑delivery is prevented. Creating/updating a delivery checks remaining quantity on the order and rejects if exceeded.
  - If an order is linked to a product, product inventory is reduced/increased based on deliveries (delta on updates, restored on delete).

- Orders
  - Reserving quantity against a specific product checks available packaged quantity minus other pending/confirmed reservations.

- Mortalities
  - Updating an event ensures you don’t reduce live birds below zero (previous count is considered to compute availability).

All critical checks are validated on the backend; the UI displays error messages returned by the API.

## Remaining high‑volume lists and pagination

Converted to server-side pagination/filters:

- Orders, Sales, Deliveries, Mortalities, Feed Usage

If you notice any other list growing large (e.g., products or slaughtered events), apply the same pattern:

1. Backend: add `findPaged` and `count` helpers in the model; update controller `getAll` to accept `page`, `limit`, and any filters; return `{ data, meta }`.
2. Frontend: fetch with query params, store `meta`, and add page size + Prev/Next controls. Avoid client-side re-filtering on top of paginated results.

## Running the app

In the `frontend` directory:

```bash
npm install
npm start
```

The app runs at <http://localhost:3000>. Ensure the backend is running and the `.env` or axios base URL is configured to reach it.

## Troubleshooting

- If lists don’t paginate, verify the backend endpoint returns `{ data, meta }` and that the query params are forwarded.
- For auth issues, confirm your token is present and valid. Log out/in to refresh.
- Inventory/availability errors are intentional guards—adjust quantities or statuses accordingly.
