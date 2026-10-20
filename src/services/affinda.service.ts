import axios from 'axios';
import FormData from 'form-data';

export const parseResume = async (file: Express.Multer.File) => {
  const formData = new FormData();

  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const apiUrl = process.env.AFFINDA_API_URL || 'https://resume-parser.affinda.com/v1/resumes/parse';
  const apiKey = process.env.AFFINDA_API_KEY;

  if (!apiKey) {
    throw new Error('AFFINDA_API_KEY is missing in environment variables');
  }

  const response = await axios.post(
    apiUrl,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  return response.data;
};
