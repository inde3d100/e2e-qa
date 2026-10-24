# Known bugs in the demo app (keep this file away from the forward-test agent)

- B-1 backend: POST /api/orders accepts qty 0, negative and text.
- B-2 backend: DELETE /api/orders/:id works without login.
- F-1 frontend: an order name with HTML runs as HTML (innerHTML).
- F-2 frontend: a double click on "Add order" makes two orders.
- F-3 frontend: an empty item name shows "Error: undefined".

## Found by the agent tests (not planted)

- `GET //` stops the server: `new URL("//", "http://x")` throws in the request handler (server.mjs). Confirmed on 4810.
- When the session ends, "Add order" shows "Error: undefined" and no login form.
- A search with no match says "No orders yet." (found in forward test 1, a question in forward test 2).
- Version 2 (forward test 2, day 2): a note is lost after a reload, because the server does not store it.
- Version 2: Delete after the session ends removes the row in the page, but the server keeps the order.
