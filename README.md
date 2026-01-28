## Table of Contents
- [Description](#description)
- [What is filestash](#what-is-filestash)
- [AI Disclosure](#ai-disclosure)
- [Icons credits](#icons-credits)
- [List of plugins](#list-of-plugins)
- [Docker image compatibility](#docker-image-compatibility)
- [How to install](#how-to-install)
- [Showcase theme plugin](#showcase-theme-plugin)
- [Showcase archive_viewer plugin](#showcase-archive_viewer-plugin)
- [License](#license)
  
# Description
Selfmade runtime plugins for filestash made for fun (or suffering?).  
I'm not affiliated in any way to the creator of filestash or the official project, this is purely a homelab/fun like project.  

# What is filestash
Filestash is a web interface to access your different filesystems created by  mickael-kerjean (https://github.com/mickael-kerjean).  
You can check the official github here:  
https://github.com/mickael-kerjean/filestash  
You can also check the official website:  
https://www.filestash.app/  

## AI Disclosure
I used AI agents to help me doing it (vibecoding).  

## Icons credits
Nearly all icons have been donwloaded from iconpacks.net (free of use)  
Icon by <a href='https://www.iconpacks.net/?utm_source=link-attribution&utm_content=13308'>Iconpacks</a>  

## Why did I made them ?
I wanted a different look for my filestash and I wanted to be able to browse my archive files.  
I love wasting my time.  
For the theme, I wasn't aiming for anything in particular, I changed many times and I'm sure you will recognise what it ended up looking like.  

## List of plugins
### theme.zip
-A different visual theme for filestash  
-Icons for multiple file extensions  
-Branding (you can change it like anything else)  
-Compatible big & small screens    
-Compatible touch screen (touch and hold to select)  

### archive_viewer.zip
-Browse archive files  
-View non binary files  
-Extract & download one or multiple files  
-Compatible big & small screens  

## Docker image compatibility
Compatible with the latest docker image available as I write this (January 28, 2026).  
https://hub.docker.com/r/machines/filestash/tags  
Digest: sha256:fb9c8a6f9674756a83a4f00266f41f43379e3224f58d4050b1e803ffa6956842  
tag: 6a80725b2116  

## How to install
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
### Computer browser
Computer light mode list :  
![Computer light mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light1.png?raw=true)  
  
Computer light mode grid :  
![Computer light mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light2.png?raw=true)  
  
Computer dark mode list :  
![Computer dark mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark1.png?raw=true)  
  
Computer dark mode grid :  
![Computer dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark2.png?raw=true)  
  
### Mobile browser
Mobile light mode list :  
![Mobile light mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light_mobile1.png?raw=true)  
  
Mobile light mode grid :  
![Mobile light mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_light_mobile2.png?raw=true)  
  
Mobile dark mode list :  
![Mobile dark mode list](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark_mobile1.png?raw=true)  
  
Mobile dark mode grid :  
![Mobile dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/theme_filestash_plugin_dark_mobile2.png?raw=true)  
  
## Showcase archive_viewer plugin
### Computer browser archive_viewer
  
Computer light mode :  
![Computer light mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_light.png?raw=true)  
  
Computer dark mode :  
![Computer dark mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_dark.png?raw=true)  
  
### Mobile browser archive_viewer
  
Mobile light mode :  
![Mobile light mode](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_light_mobile.png?raw=true)  
  
Mobile dark mode :  
![Mobile dark mode grid](https://github.com/Apoze/filestash_plugins/blob/main/Showcase/archive_viewer_filestash_plugin_dark_mobile.png?raw=true)  

  
## License

This project is licensed under the MIT License — see the LICENSE file for details.  
