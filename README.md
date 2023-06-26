# Voron Construct Fusion 360 Add-In

## Installation

- Download `Construct.zip` from the latest release: https://github.com/MapleLeafMakers/VoronConstruct360/releases
- extract the contents into your Fusion360 AddIns directory:
  - `%appdata%\Autodesk\Autodesk Fusion 360\API\AddIns` on Windows
  - `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/` on MacOS

## Building from source

Clone the repository, and run:

```sh
pip install plugin/requirements.txt --target=plugin/lib
npm install
npm run build
```

The plugin will be generated in the `dist/` directory, copy the contents into a new directory named Construct in the Fusion360 AddIns directory
