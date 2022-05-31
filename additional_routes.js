const formidable = require('formidable');
const {copyFile, unlink} = require('fs/promises');
const {generateJwtToken} = require('./jwt-authenticate');

const handleUploadFile = async (req, file) => {
  const uploadFolder = 'uploads';
  file.name = Date.now() + file.name;
  try {
    // Copy file from temp folder to uploads folder (not rename to allow cross-device link)
    await copyFile(file.path, `./public/${uploadFolder}/${file.name}`);

    // Remove temp file
    await unlink(file.path);

    // Return new path of uploaded file
    file.path = `${req.protocol}s://${req.get('host')}/${uploadFolder}/${
      file.name
    }`;

    return file;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  loginHandler: (db, req, res) => {
    const {email, password: pwd} = req.body;

    //
    const account = db
    .get('users')
    .find((user) => email && user.email === email)
    .value();

    if (!account) {
      res.status(400).jsonp({
        email:
          'Email is not registered',
      });
      return;
    } else {
      if (account.password === pwd) {
        const token = generateJwtToken(account.id);
        const {password, ...userWithoutPassword} = account;
  
        res.jsonp({
          ...userWithoutPassword,
          token,
        });
      } else {
        res.status(400).jsonp({
          password:
            'Incorrect password',
        });
      }
    }
  },

  registerHandler: (db, req, res) => {
    const {name, email, password: pwd} = req.body;

    const existEmail = db
      .get('users')
      .find((user) => email && user.email === email)
      .value();

    if (existEmail) {
      res.status(400).jsonp({
        email:
          'Email is already in use',
      });
      return;
    }

    const lastUser = db.get('users').maxBy('id').value();
    const newUserId = parseInt(lastUser.id, 10) + 1;
    const newUser = {
      id: newUserId,
      ...req.body,
      gender: 'Please update your gender',
      avatar: 'https://i.pinimg.com/originals/28/f6/1f/28f61f512eb2b3042b82b2bdfd48b907.jpg',
      job: 'Please update your job',
      think: 'Please share your life motto so people understand you better',
      phone: 'Please update your phone',
      birthday: 'Please update your birthday',
      address: 'Please update your address'
    };

    db.get('users').push(newUser).write();

    const token = generateJwtToken(newUser.id);
    const {password, ...userWithoutPassword} = newUser;

    res.jsonp({
      ...userWithoutPassword,
      token,
    });
  },

  uploadFileHandler: (req, res) => {
    if (req.headers['content-type'] === 'application/json') {
      res
        .status(400)
        .jsonp({message: 'Content-Type "application/json" is not allowed.'});
      return;
    }

    const form = formidable();

    form.parse(req, async (error, fields, files) => {
      let file = files.file;

      if (error || !file) {
        res.status(400).jsonp({message: 'Missing "file" field.'});
        return;
      }

      try {
        file = await handleUploadFile(req, file);
        res.jsonp(file);
      } catch (err) {
        console.log(err);
        res.status(500).jsonp({message: 'Cannot upload file.'});
      }
    });
  },

  uploadFilesHandler: (req, res) => {
    if (req.headers['content-type'] === 'application/json') {
      res
        .status(400)
        .jsonp({message: 'Content-Type "application/json" is not allowed.'});
      return;
    }

    const form = formidable({multiples: true});

    form.parse(req, async (error, fields, files) => {
      let filesUploaded = files.files;

      if (error || !filesUploaded) {
        res.status(400).jsonp({message: 'Missing "files" field.'});
        return;
      }

      // If user upload 1 file, transform data to array
      if (!Array.isArray(filesUploaded)) {
        filesUploaded = [filesUploaded];
      }

      try {
        // Handle all uploaded files
        filesUploaded = await Promise.all(
          filesUploaded.map(async (file) => {
            try {
              file = await handleUploadFile(req, file);
              return file;
            } catch (err) {
              throw err;
            }
          }),
        );

        res.jsonp(filesUploaded);
      } catch (err) {
        console.log(err);
        res.status(500).jsonp({message: 'Cannot upload files.'});
      }
    });
  },
};
