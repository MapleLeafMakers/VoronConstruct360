# Voron Construct Fusion 360 Add-In

## Building from source

Clone the repository, and run:

```sh
npm install
npm run build
```

The plugin will be generated in the `dist/` directory.  copy the contents into a new Folder in your Fusion360 AddIns directory:

 - `%appdata%\Autodesk\Autodesk Fusion 360\API\AddIns` on Windows
 - `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/` on MacOS
