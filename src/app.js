import express from 'express';
import socketio from 'socket.io';
import bodyParser from 'body-parser';
import path from 'path';
import models from './models';
import axios from './lib/axios'

// Initialisation
const app = express()
    .use(bodyParser.json())
    .use(express.static(path.join(__dirname, '../src/public')));

app.locals.models = models;

const server = app.listen(process.env.PORT || 3001, () => {
    console.log('Server ready');
});
const io = socketio.listen(server);

// Variables*
let orders = []

// API
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, OPTIONS, DELETE");
    next();
});

app.post('/orders', async (req, res) => {
  console.log('NEW ORDER')
    let buyer = null
    try {
      const res = await axios.get(`/bouffe/place/${req.body.code}`)
      if(res)
        buyer = res.data
    } catch (e) {
      console.log(e.response.data)
    }
    const { category, code, price, effectivePrice, lowerPrice, name, status, items } = req.body
    models.Order.save({
        category,
        code: `${code}`,
        price,
        effectivePrice,
        lowerPrice,
        name,
        items,
        status,
        buyerName: buyer ? buyer.name : `${code}`,
        buyerFirstName: buyer ? buyer.firstname : '',
        createdAt: new Date(),
        editedAt: new Date(),
    }).then(result => {
      res.json(result)
    })
    .catch(e => console.log(e))
    
});
app.get('/orders', (req, res) => {
  //res.json(orders) //not used ?
});

app.put('/orders/:id', (req, res) => {
  console.log('PUT')
  models.Order.get(req.params.id).update({ status: req.body.status }).run().then(result => {
    res.json(result)
  }).catch(e => console.log(e))
})

app.delete('/orders/:id', (req, res) => {
  console.log('DELETE', req.params.id)
  if (req.body.force) {
    models.Order.get(req.params.id).delete().run().catch(e => console.log(e))
    console.log('DELETE')
  }
  else {
    models.Order.get(req.params.id).update({ removed: true }).run().catch(e => console.log(e))
    console.log('UPDATE', req.params.id)
  }
})

// Evenements socket.io
io.on('connection', socket => {
    console.log('Client connected')
    io.sockets.emit('orders', orders)
});


models.Order.execute().then(cursor => {
  orders = cursor
})
.catch(e => console.log(e))

models.Order.changes().then(feed => {
  updateStoreAndSend('orders', orders, feed);
})
.catch(e => console.log(e))

// Fonctions
function updateStoreAndSend(node, store, feed) {
    feed.each((err, doc) => {
        if(err) return;

        if (doc.isSaved() === false) {
            let i = 0;
            for (const o of store) {
                if (o.id === doc.id) {
                    break;
                }

                ++i;
            }
            store.splice(i, 1);
        } else if(doc.getOldValue() == null) {
            store.push(Object.assign({}, doc));
        } else {
            store.forEach((o, i) => {
                if (o.id === doc.id) {
                    store[i] = Object.assign(store[i], doc);
                }
            });
        }

        io.sockets.emit(node, store)
    });
}
