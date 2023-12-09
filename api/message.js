module.exports = async (req, res) => {
    var data = {
        msg: "Hello World",
    };
    res.status(200).json(data);
};
