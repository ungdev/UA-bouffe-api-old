import express from 'express';
import socketio from 'socket.io';
import bodyParser from 'body-parser';
import path from 'path';
import models from './models';

// Initialisation
const app = express()
    .use(bodyParser.json())
    .use(express.static(path.join(__dirname, '../src/public')));

app.locals.models = models;

const server = app.listen(3001, () => {
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

app.post('/orders', (req, res) => {
    console.log('Order received')
    const { category, code, price, effectivePrice, lowerPrice, name, status } = req.body
    models.Order.save({
        category,
        code,
        price,
        effectivePrice,
        lowerPrice,
        name,
        status,
    }).then(result => {
      res.json(result)
    })
    
});
app.get('/orders', (req, res) => {
  res.json(orders)
});

app.put('/orders/:id', (req, res) => {
  models.Order.get(req.params.id).run().then(inst => {
    inst.delete()
    models.Order.save({
      id: inst.id,
      category: inst.category,
      code: inst.code,
      price: inst.price,
      effectivePrice: inst.effectivePrice,
      lowerPrice: inst.lowerPrice,
      name: inst.name,
      createdAt: inst.createdAt,
      status: req.body.status,
      removed: false,
    }).then(result => {
      res.json(result)
    })
  })
})

app.delete('/orders/:id', (req, res) => {
  models.Order.get(req.params.id).run().then(inst => {
    inst.delete()
    if(!req.body.force){
      models.Order.save({
        id: inst.id,
        category: inst.category,
        code: inst.code,
        price: inst.price,
        effectivePrice: inst.effectivePrice,
        lowerPrice: inst.lowerPrice,
        name: inst.name,
        createdAt: inst.createdAt,
        status: inst.status,
        removed: true,
      }).then(result => {
        res.json(result)
      })
    }
  })
})

// Evenements socket.io
io.on('connection', socket => {
    console.log('Client connected')
    io.sockets.emit('orders', orders)
});
-

models.Order.execute().then(cursor => {
  orders = cursor;
});

models.Order.changes().then(feed => {
  updateStoreAndSend('orders', orders, feed);
});

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
        console.log('EMIT on', node)
    });
}
