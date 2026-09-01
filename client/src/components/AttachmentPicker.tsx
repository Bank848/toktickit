import { useId, useState } from 'react';

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
}

function extensionOf(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function validate(file: File): string | null {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `${file.name}: file type not allowed`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `${file.name}: file exceeds 5 MB`;
  }
  return null;
}

export function AttachmentPicker({ files, onChange }: Props) {
  const inputId = useId();
  const [rejections, setRejections] = useState<string[]>([]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;

    const accepted: File[] = [];
    const nextRejections: string[] = [];
    for (const file of picked) {
      const error = validate(file);
      if (error) {
        nextRejections.push(error);
      } else {
        accepted.push(file);
      }
    }
    setRejections(nextRejections);
    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label htmlFor={inputId}>Attachments</label>
      <input
        id={inputId}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        onChange={handleInputChange}
      />
      {rejections.length > 0 && (
        <ul role="alert">
          {rejections.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              {file.name}
              <button type="button" onClick={() => handleRemove(index)} aria-label={`Remove ${file.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
