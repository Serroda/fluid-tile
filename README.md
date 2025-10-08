<p align="center">
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/logo.svg" width="200"/>
</p>

# Fluid tile

A script for Kwin that auto adjusts windows to the custom KDE Plasma 6 tiling layout by creating and removing virtual desktops.

## Support

If you like the project, you can support me by buying me a coffee or with other options available here

<a href='https://ko-fi.com/M4M81LR295' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
<a href="https://liberapay.com/Serroda/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a>

## Features

- 🚀 Working on KDE Plasma 6 (or superior)
- 🛠️ KWin native tiling 
- 🪟 Smooth tiling
- 🖼️ Working with custom layout (Meta + T)
- 💻 Auto create and delete virtual desktops
- ⛔ Blocklist for apps to which you don't want the script to apply
- ⚙️ User options
- 🔢 Configures the priority order of windows according to the width, height and position of the tiles
- 🔳 Select the default tile layout when creating a new virtual desktop

## Preview

[![Watch the video](https://i.ytimg.com/vi/U04QsvblbSA/hqdefault.jpg?sqp=-oaymwFBCNACELwBSFryq4qpAzMIARUAAIhCGAHYAQHiAQoIGBACGAY4AUAB8AEB-AH-CIAC0AWKAgwIABABGH8gHSgZMA8=&rs=AOn4CLDTqR09B7FJOcqmOJQ5cqNI4rwRPA)](https://youtu.be/U04QsvblbSA)

## Screenshots

  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot1.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot2.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot3.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot4.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot5.png" width="200"/>

## User options

> **WARNING**: If you change the script settings while it is still active,
> you must deactivate and reactivate it for the changes to take effect.

`Settings > KWin Scripts > Click on the cogwheel icon for the ‘Fluid-tile’ option`

## Installation

### Manual

- 1. Clone the repository

```sh
git clone https://codeberg.org/Serroda/fluid-tile.git -b release
```

- 2. Install the script

```sh
kpackagetool6 --type=KWin/Script -i ./fluid-tile/
```

- 3. Enable it in the KDE settings

`Settings > KWin Scripts > Check "Fluid tile" > Apply changes`

### KDE Store

[Link](https://store.kde.org/p/2322321)

`Settings > KWin Scripts > Click on "Get New" button > Search 'Fluid tile' > Install`

## F.A.Q
### Differences between other tile managers

The main difference is that `Fluid tile` uses the native KWin API to manage windows and layout, ensuring a smoother integration with native KDE, this means that the customization options are more limited for the user compared to other options. 

Install `Fluid tile` if you want a native KDE tiling, while if you want something more customized use other options like Krohnkite or Polonium

### Shortcuts

You can use the native KDE shortcuts, my recommendation is to change the shortcuts for `Window Management`, specifically change `Custom Quick Tile Window to the Bottom/Left/Right/Top` to `Meta + Down/Left/Right/Up` for smoother use 
