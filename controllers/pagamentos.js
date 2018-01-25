var logger = require('../servicos/logger.js');

module.exports = function(app){
  app.get('/pagamentos', function(req, res){
    console.log('Recebida requisição de teste na porta 3000.');
    res.send('OK!');
  });

  app.get('/pagamentos/pagamento/:id', function(req, res){
    var id = req.params.id;
    logger.log('info', 'Consultando pagamento: ' + id);

    var memcachedClient = app.servicos.memcachedClient();

    memcachedClient.get('pagamento-' + id, function(error, retorno){
      if(error || !retorno){
        console.log('MISS - chave nao encontrado');

        var connection = app.persistencia.connectionFactory();
        var pagamentoDAO = new app.persistencia.PagamentoDAO(connection);

        pagamentoDAO.buscaPorId(id, function(erro, resultado){
          if(erro){
            logger.log('error', 'Erro ao consultar no banco: ' + erro);
            res.status(500).send(erro);
            return;
          }
          console.log('Pagamentos encontrado: ' + JSON.stringify(resultado));
          res.json(resultado);
        });
      // HIT no cache
      } else {
        console.log('HIT - valor: ' + JSON.stringify(retorno));
        res.json(retorno);
        return;
      }
    });
  });

  app.put('/pagamentos/pagamento/:id', function(req, res){
    var pagamento = {};
    var id = req.params.id;

    pagamento.id = id;
    pagamento.status = 'CONFIRMADO';

    var connection = app.persistencia.connectionFactory();
    var pagamentoDAO = new app.persistencia.PagamentoDAO(connection);

    pagamentoDAO.atualiza(pagamento, function(erro){
      if(erro){
        console.log("Erro ao atualiza o banco: " + erro);
        res.status(500).send(erro);
        return;
      }

      res.send(pagamento);
      console.log("Status do ID: " + id + ", atualizado com sucesso (CONFIRMADO).");
    });
  });

  app.delete('/pagamentos/pagamento/:id', function(req, res){
    var pagamento = {};
    var id = req.params.id;

    pagamento.id = id;
    pagamento.status = 'CANCELADO';

    var connection = app.persistencia.connectionFactory();
    var pagamentoDAO = new app.persistencia.PagamentoDAO(connection);

    pagamentoDAO.atualiza(pagamento, function(erro){
      if(erro){
        console.log("Erro ao atualiza o banco: " + erro);
        res.status(500).send(erro);
        return;
      }

      res.status(204).send(pagamento);
      console.log("Status do ID: " + id + ", atualizado com sucesso (CANCELADO).");
    });
  });

  app.post('/pagamentos/pagamento', function(req, res){
    req.assert("pagamento.forma_de_pagamento", "Forma de pagamento é obrigatório!").notEmpty();
    req.assert("pagamento.valor", "Valor é obrigatório, e deve ser um decimal.").notEmpty().isFloat();

    var erro = req.validationErrors();

    if(erro){
      console.log("Erros de validação encontrados!");
      res.status(400).send(erro);
      return;
    }

    var pagamento = req.body["pagamento"];
    var cartao = req.body["cartao"];

    console.log("Processamento pagamento...");

    pagamento.status = "CRIADO";
    pagamento.data = new Date;

    var connection = app.persistencia.connectionFactory();
    var pagamentoDAO = new app.persistencia.PagamentoDAO(connection);

    pagamentoDAO.salva(pagamento, function(erro, resultado){
      if(erro){
        console.log("Erro ao inserir no banco: " + erro);
        res.status(500).send(erro);
      } else {
        console.log('Pagamento criado!');
        pagamento.id = resultado.insertId;

        var memcachedClient =  app.servicos.memcachedClient();

        memcachedClient.set('pagamento-' + pagamento.id, pagamento, 60000, function(error){
          console.log('nova chave adicionada ao cache: pagamento-' + pagamento.id);
        });

        if(pagamento.forma_de_pagamento == 'cartao'){
          console.log(cartao);

          var clienteCartoes = new app.servicos.clienteCartoes();
          clienteCartoes.autoriza(cartao, function(exception, request, response, retorno){
            if(exception){
              console.log(exception);
              res.status(400).send(exception);
              return;
            }

            console.log(retorno);
            res.location('/pagamentos/pagamento/' + pagamento.id);
            res.status(201).json(hateoas(pagamento, retorno));
          });
        } else {
          res.location('/pagamentos/pagamento/' + pagamento.id);
          res.status(201).json(hateoas(pagamento, cartao));
          console.log("Status do ID: " + pagamento.id + ", criado com sucesso (CRIADO).");
        }
      }
    });

  });

  function hateoas(pagamento, cartao){
    var response = {
      dados_do_pagamento: pagamento,
      cartao: cartao,
      links: [
        {
          href: "http://localhost:3000/pagamentos/pagamento/" + pagamento.id,
          rel: "confirmar",
          method: "PUT"
        },
        {
          href: "http://localhost:3000/pagamentos/pagamento/" + pagamento.id,
          rel: "cancelar",
          method: "DELETE"
        }
      ]
    }
    return response;
  }

};
