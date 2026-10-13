import './config/env';
import { app } from './app';
import { connectDB } from './config/db';

const port = Number(process.env.PORT || 4000);

connectDB()
                .then(() => {
                                console.log(JSON.stringify({ level: 'info', message: 'MongoDB connected' }));
                                app.listen(port, () => console.log(`EduAI backend listening on ${port}`));
                })
                .catch((error: Error) => {
                                console.error(JSON.stringify({
                                                level: 'error',
                                                message: 'MongoDB connection failed',
                                                detail: error.message,
                                }));
                                process.exit(1);
                });
