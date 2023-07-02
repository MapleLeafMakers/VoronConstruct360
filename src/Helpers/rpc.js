import { JSONRPCClient } from 'json-rpc-2.0';

const _rpc = new JSONRPCClient((jsonRPCRequest) => {
  window.adsk.fusionSendData('jsonrpc', JSON.stringify(jsonRPCRequest));
});


window.fusionJavaScriptHandler = {
  handle: function (action, data) {
    try {
      if (action == 'jsonrpc') {
        _rpc.receive(JSON.parse(data));
      }

    } catch (e) {
      console.log(e);
      console.log('exception caught with command: ' + action + ', data: ' + data);
    }
    return 'OK';
  }
};

const fusionRpc = {
  request: async (method, params, clientParams) => {
    return _rpc.request(method, params, clientParams);
  }
}

const noRpc = {
  request: async (method, params, clientParams) => {
    if (method === "kv_set") {
      localStorage.setItem(params.key, JSON.stringify(params.value));
    } else if (method === "kv_get") {
      return JSON.parse(localStorage.getItem(params.key));
    } else if (method === "kv_mset") {
      for (const [key, value] of Object.entries(params.obj)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } else if (method === "kv_mget") {
      return Object.fromEntries(params.keys.map(k => [k, JSON.parse(localStorage.getItem(k))]));
    }
  }
}

const rpc = {
  init: async () => {
    if (window.adsk === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (window.adsk === undefined) {
        rpc.request = noRpc.request;
        console.log("Fusion360 was not found.");
        return;
      }
    }
    console.log("Fusion360 was found.");
    rpc.request = fusionRpc.request;
  }
}

export default rpc;