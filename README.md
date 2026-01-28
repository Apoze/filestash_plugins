# filestash_plugins
Selfmade runtime plugins for filestash made for fun (or suffering?).

## AI Disclosure
I used AI agents to help me doing it (vibecoding).

## Why did I made it ?
I wanted a different look for my filestash.  
I love wasting my time.  
I wasn't aiming for anything in particular, I changed many times and I'm sure you will recognise what it ended up looking like.

## How to use:
Put the .zip of a plugin in the "plugins" folder of your filestash container. "filestash:/app/data/state/plugins/" (assuming filestash is the name of your volume).

How to do that:
Check the name of your volume, either in your docker-compose.yml or:
```bash
docker volume ls
```

Copy the zip in your container (assuming your volume name is "filestash"):
```bash
docker cp ./plugins/archive_viewer.zip filestash:/app/data/state/plugins/
```

Check it worked (assuming your container name is "filestash"):
```bash
docker exec -it filestash sh -lc 'ls -la /app/data/state/plugins/
```

Restart your filestash container:
```bash
docker restart filestash && docker compose ps -a
```

**Clear your cache to see the changes (cloudflare/browser)**

## License

This project is licensed under the MIT License — see the LICENSE file for details.
