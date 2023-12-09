import { VercelRequest, VercelResponse } from '@vercel/node';

module.exports = async (req: VercelRequest, res: VercelResponse) => {
    var data = {
        ua: req.headers['user-agent']?.toString(),
    };

    res.status(200).json(data);
};
