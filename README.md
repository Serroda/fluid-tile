<p align="center">
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/commit/c9e0711d2197a583ad5c6d4e56a9003a70e7f724/.meta/logo.svg" width="200"/>
</p>

# Fluid tile

A script for Kwin that auto adjusts windows to the custom KDE Plasma 6 tiling layout by creating and removing virtual desktops.

## Features

- 🚀 Working on KDE Plasma 6.4.5
- 🪟 Smooth tiling
- 🖼️ Working with custom layout 
- 💻 Auto create and delete virtual desktops

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
