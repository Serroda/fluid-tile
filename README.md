<p align="center">
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/commit/c9e0711d2197a583ad5c6d4e56a9003a70e7f724/.meta/logo.svg" width="200"/>
</p>

# Fluid tile

A script for Kwin that auto adjusts windows to the custom KDE Plasma 6 tiling layout by creating and removing virtual desktops.

## Features

- 🚀 Working on KDE Plasma 6.4.5
- 🪟 Smooth tiling
- 🖼️ Working with custom layout (Super + T)
- 💻 Auto create and delete virtual desktops
- ⛔ Blacklist for apps to which you dont want the script to apply
- ⚙️ User options

## User options

> **WARNING**: If you change the script settings while it is still active,
> you must deactivate and reactivate it for the changes to take effect.

`Settings > KWin Scripts > Click on the cogwheel icon for the ‘Fluid-tile’ option`

## Installation

### Manual

- 1. Clone the repository

```sh
git clone https://codeberg.org/Serroda/fluid-tile.git
```

- 2. Install the script

```sh
kpackagetool6 --type=KWin/Script -i ./fluid-tile/
```

- 3. Enable it in the KDE settings

`Settings > KWin Scripts > Check "Fluid tile" > Apply changes`

## Support

If you like the project, you can support me by buying me a coffee or with other options available here

<a href='https://ko-fi.com/M4M81LR295' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
<a href="https://liberapay.com/Serroda/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a>
