const express = require ('express');
const app = express();
const bodyParser = require('body-parser');
const knex = require('knex');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const nodemailer = require("nodemailer");

const db = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      user : 'postgres',
      password : 'test',
      database : 'mizu'
    }
  });

app.use(bodyParser.json());
app.use(cors());


async function sendEmail(userEmail, messageTxt, hour, day, month) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'kayrosecash@gmail.com', 
        pass: 'gvozden88' 
      },
      tls: {
          rejectUnauthorized: false
      }
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: `"${ userEmail }" <smtp.kayrosecash@gmail.com>`, // sender address
      to: "kayrosecash@gmail.com", // list of receivers
      subject: "Hello from Mizu!", // Subject line
      text: `${messageTxt}. ${month} ${day} ${hour + ':00'}`  // plain text body
    });
  
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    
  }
  
//   sendEmail().catch(console.error);

app.get('/', (req, res) => {res.send('it is working')});

app.post('/sendemail', (req, res) => {
    const { emailAddress, message} = req.body;
    sendEmail(emailAddress, message)
    .then(console.log('poslali smo mail!'))
    .catch(err => res.json(err));
    res.json('e-mail je poslat');
});

app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    db('users').where('email', email)
    .then(response => {
        if (!response[0]) {
            res.json('Ovaj korisnik ne postoji')
        } else {
          bcrypt.compareSync(password, response[0].password, function(err, result) {
            // result == true
            if (err) {
                console.log('oopsie');
                res.json('err')
            } else if (result) {
                db.select('name', 'email', 'isadmin').from('users').where('email', email)
                .then(data => res.json(data))
                console.log('logged in');
                // res.json('bravo')
            } else if(!result) {
                console.log('oops, ime ili lozinka nisu ok');
                res.json('Oops, e-mail ili lozinka nisu ok')
            }
        });  
        }  
    })
    .catch(err => res.status(400).json(err))
});

app.post('/register', (req, res) => {
    const { name, email, password} = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    db('users').insert({name: name, email: email, password: hash}).returning(['id'])
    .then(function(response) {
        return db('schedule').insert({user_id: response[0].id, email: email}) 
    })
    .catch(err => res.status(400).json(err))
    res.json(`Got a register request for ${name} and pass is hashed`);
});

app.delete('/delete', (req, res) => {
    const { email, password } = req.body;
    db.select('name', 'password').from('users').where('email', email)
    .then(data => bcrypt.compareSync(password, data[0].password))
    .then(data => {
        if(data) {
            db('users')
            .where('email', email)
            .del()
            .then(console.log('deleted'))
        } else {
            console.log('nonon')
        }
    }
    )
    .catch(err => res.status(400).json('fck if i know', err))
    res.json('Got a DELETE request at /user')
});

app.post('/meeting', (req, res) => {
    const { email, hour, day, month, msg } = req.body;
    db.select('id').from('users').where('email', email).returning(['id'])
    .then(function(response) {
        db('schedule').insert([{hour: hour, day: day, month: month, message: msg, email: email, user_id: response[0].id}])
        .then(sendEmail(email, msg, hour, day, month))
    })
    .catch(err => res.status(400).json('Doslo je do greske...'))
    res.json('Success, We have a date!')
});

app.post('/getschedule', (req, res) => {
    const { email } = req.body;
    db.select('hour', 'day', 'month', 'message', 'id').from('schedule').where('email', email)
    .then(data => res.json(data))
    .catch(err => res.status(400).json('oops', err));
});

app.delete('/deleteappointment', (req, res) => {
    const { id } = req.body;
    db('schedule').where('id', id).del()
    .then(console.log)
    .catch(err => err.status(400).json(err))
    res.json('obrisan iz schedule')
});

app.get('/getusers', (req, res) => {
    db.select('*').from('users')
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err))
});

app.delete('/adminsdelete', (req, res) => {
    const { id } = req.body;
    db('users').where('id', id).del()
    .then(res => res.json('korisnik je obrisan'))
    .then(
        db('schedule').where('user_id', id).del()
        .then(res=> res.json('obrisan schedule')) 
    )
    .catch(err => res.json(err))
});

app.post('/makeadmin', (req, res) => {
    const { id } = req.body;
    db('users').where('id', id)
        .update({ isadmin: true })
        .catch(err => res.json(err))
    res.json('new admin added')
});

app.listen(process.env.PORT || 3001, () => console.log(`Example app listening at ${process.env.PORT}`));