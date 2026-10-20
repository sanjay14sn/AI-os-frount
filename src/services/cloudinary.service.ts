import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';

export const uploadImageToCloudinary = async (filePath: string): Promise<string> => {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'placementos';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    form,
    { headers: form.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 8000 },
  );

  const url = response.data?.secure_url;
  if (!url) throw new Error('Cloudinary did not return an image URL');
  return url as string;
};
