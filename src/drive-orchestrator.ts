/**
 * Google Drive MCP Orchestrator for Mojulo
 * Organizes 3D models, deterministic recipes, and outcome documentation in Google Drive.
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

export interface UploadAssetParams {
  folderName: string;
  filename: string;
  mimeType: string;
  data: Buffer | string;
}

export class GoogleDriveOrchestrator {
  private drive: any = null;

  private async getDriveClient() {
    if (this.drive) return this.drive;

    // Supports Service Account or OAuth2 Token
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    this.drive = google.drive({ version: 'v3', auth });
    return this.drive;
  }

  /**
   * Finds or creates a designated folder in Google Drive.
   */
  async ensureFolder(folderName: string, parentId = 'root'): Promise<string> {
    const drive = await this.getDriveClient();

    // Query existing folder
    const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
    const res = await drive.files.list({ q, fields: 'files(id, name)' });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id!;
    }

    // Create new folder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id'
    });

    console.log(`Created Google Drive folder: ${folderName} (${folder.data.id})`);
    return folder.data.id!;
  }

  /**
   * Uploads binary 3D assets (.stl, .3mf, .glb) or recipes to Drive.
   */
  async uploadAsset({ folderName, filename, mimeType, data }: UploadAssetParams) {
    const drive = await this.getDriveClient();
    const folderId = await this.ensureFolder(folderName);

    const stream = new Readable();
    stream.push(typeof data === 'string' ? Buffer.from(data) : data);
    stream.push(null);

    const fileMetadata = {
      name: filename,
      parents: [folderId]
    };

    const media = {
      mimeType,
      body: stream
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    return {
      fileId: file.data.id!,
      folderId,
      filename: file.data.name!,
      webViewLink: file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`
    };
  }

  /**
   * Stores complete Mojulo build bundle (recipe + STL + assembly guide).
   */
  async archiveBuildBundle(projectName: string, bundle: {
    recipeJson: string;
    stlBuffer: Buffer;
    manualHtml: string;
  }) {
    const projectFolderId = await this.ensureFolder(projectName);

    const [recipeRes, stlRes, manualRes] = await Promise.all([
      this.uploadAsset({
        folderName: projectName,
        filename: 'recipe.mojulo.json',
        mimeType: 'application/json',
        data: bundle.recipeJson
      }),
      this.uploadAsset({
        folderName: projectName,
        filename: `${projectName}.stl`,
        mimeType: 'model/stl',
        data: bundle.stlBuffer
      }),
      this.uploadAsset({
        folderName: projectName,
        filename: 'assembly-guide.html',
        mimeType: 'text/html',
        data: bundle.manualHtml
      })
    ]);

    return {
      projectFolderId,
      recipeLink: recipeRes.webViewLink,
      stlLink: stlRes.webViewLink,
      manualLink: manualRes.webViewLink
    };
  }
}

export const driveOrchestrator = new GoogleDriveOrchestrator();