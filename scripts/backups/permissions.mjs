import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { fail, noLinks } from './files.mjs';

const exec = promisify(execFile);

// Node's mode 0700/0600 does not restrict Windows ACLs. Limit the private root
// to its owner, SYSTEM and administrators before writing settings or memories.
export async function protectPrivateDirectory(directory) {
  await noLinks(directory);
  if (process.platform !== 'win32') { await fs.chmod(directory, 0o700); return; }
  const script = `
    $ErrorActionPreference = 'Stop'
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
      $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
      $acl.AddAccessRule($rule)
    }
    ([IO.DirectoryInfo]::new($env:ALICE_BACKUP_PRIVATE_DIRECTORY)).SetAccessControl($acl)
  `;
  try {
    await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, env: { ...process.env, ALICE_BACKUP_PRIVATE_DIRECTORY: directory },
    });
  } catch {
    fail('No se pudieron proteger los permisos de la carpeta privada; no se escribiran datos alli.');
  }
}
