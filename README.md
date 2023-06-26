# Voron Construct Fusion 360 Add-In

## Installation

- Download `Construct.zip` from the [latest release](https://github.com/MapleLeafMakers/VoronConstruct360/releases).

- Extract the contents into your Fusion360 Add-Ins directory:
  - Windows:
    ```txt
    %appdata%\Autodesk\Autodesk Fusion 360\API\AddIns
    ```
  - MacOS:
    ```txt
    ~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns
    ```

<details>
    <summary>
        <b>
        Alternatively, you can build from source:
        </b>
    </summary>
<p>

Clone the repository, and run:

```sh
pip install plugin/requirements.txt --target=plugin/lib
npm install
npm run build
```

The plugin will be generated in the `dist/` directory, copy the contents into a new directory named Construct in the Fusion360 AddIns directory

</p>
</details>

<br>

## Usage
 
- A new entry will be added under the 'Insert' menu on the SOLIDS Panel.
- Click the <picture><img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Wikipedia_interwiki_section_gear_icon.svg"></picture> icon to enter your github personal access token.

    - How do I generate a github access token?
      1. Make sure you're logged into github, and go to github's [app settings](https://github.com/settings/apps), then click on **Personal access tokens**, and choose the token type (classic is fine).

      2. Click the **Generate new token** dropdown menu, and choose the token usage (classic is fine).

      3. Enter a note of what this token will be used for, select an expiry time, select a scope (or none at all, none are currently needed for Voron Construct) and click **Generate token** at the bottom of the page.

      4. You will be provided a token that you can copy directly to your clipboard and paste into the <br> plugin's token field in the <picture><img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Wikipedia_interwiki_section_gear_icon.svg"></picture> menu.

- Enter a repository in `<owner>/<repo>` format (eg. kyleisah/Voron-Construct) and click Load.

Now, you have CAD. Lots of CAD.
