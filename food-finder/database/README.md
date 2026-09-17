# BHOOK database export

Run `npm run export:db` from `food-finder` to regenerate `bhook.sql` from the
configured database. The export contains the restaurant/menu catalog and price
history. It does not read or include `.env`, OAuth tokens, or saved addresses.

Import into a MySQL-compatible database:

```bash
mysql --host HOST --port PORT --user USER --password DATABASE < database/bhook.sql
```

For TiDB Cloud Starter, use the connection command shown by its **Connect**
dialog so TLS is enabled.
