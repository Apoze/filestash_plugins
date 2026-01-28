# filestash_plugins  
Selfmade runtime plugins for filestash made for fun (or suffering?).  

## AI Disclosure  
I used AI agents to help me doing it (vibecoding).  

## Images and Icons credits  
Nearly all icons have been donwloaded from iconpacks.net (free of use)  
Icon by <a href='https://www.iconpacks.net/?utm_source=link-attribution&utm_content=13308'>Iconpacks</a>  
  
## License  

This project is licensed under the MIT License — see the LICENSE file for details.  

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

## Showcase theme plugin  
**Computer browser**  
Computer light mode list :  
![Computer light mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light1.png?raw=true)  
  
Computer light mode grid :  
![Computer light mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light2.png?raw=true)  
  
Computer dark mode list :  
![Computer dark mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark1.png?raw=true)  
  
Computer dark mode grid :  
![Computer dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark2.png?raw=true)  
  
**Mobile browser**  
Mobile light mode list :  
![Mobile light mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light_mobile1.png?raw=true)  
  
Mobile light mode grid :  
![Mobile light mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light_mobile2.png?raw=true)  
  
Mobile dark mode list :  
![Mobile dark mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark_mobile1.png?raw=true)  
  
Mobile dark mode grid :  
![Mobile dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark_mobile2.png?raw=true)  
  
## Showcase archive_viewer plugin  
**Computer browser**  
  
Computer light mode :  
![Computer light mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_light.png?raw=true)  
  
Computer dark mode :  
![Computer dark mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_dark.png?raw=true)  
  
**Mobile browser**  
  
Mobile light mode :  
![Mobile light mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_light_mobile.png?raw=true)  
  
Mobile dark mode :  
![Mobile dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_dark_mobile.png?raw=true)  
