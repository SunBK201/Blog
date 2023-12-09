import { VercelRequest, VercelResponse } from '@vercel/node';

module.exports = async (req: VercelRequest, res: VercelResponse) => {
    var data = {
        msg: "Hello World" + req.headers['User-Agent']?.toString(),
    };

    console.log(req.headers);
    
    res.status(200).json(data);
};
