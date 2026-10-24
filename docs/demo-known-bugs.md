# Known bugs in the demo app

This file lists the answers. Do not give it to the agent before its first round.

## The 5 planted bugs

| ID | Side | Bug |
|---|---|---|
| B-1 | API | `POST /api/orders` accepts a quantity of 0, a negative number and text. |
| B-2 | API | `DELETE /api/orders/:id` works without a login. |
| F-1 | Page | An item name with HTML runs as HTML, because the list uses `innerHTML`. |
| F-2 | Page | A double click on **Add order** makes two orders. |
| F-3 | Page | An empty item name shows "Error: undefined". |

## Real bugs that agents also found

We did not plan these bugs. Test agents found them in the demo app.

- A request to `//` stops the server. `new URL()` throws in the request handler.
- When the session ends, **Add order** shows "Error: undefined" and no login form.
- A search with no match shows "No orders yet.", although orders exist.

A good first round finds the 5 planted bugs. It can also find some of the others.
