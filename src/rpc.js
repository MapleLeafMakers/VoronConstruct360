import { JSONRPCClient } from 'json-rpc-2.0';

const rpc = new JSONRPCClient((jsonRPCRequest) => window.adsk.fusionSendData('jsonrpc', JSON.stringify(jsonRPCRequest)));

window.fusionJavaScriptHandler = {handle: function(action, data) {
  try {
      if (action == 'jsonrpc') {
        console.log(JSON.parse(data));
        rpc.receive(JSON.parse(data));
      }
      
  } catch (e) {
      console.log(e);
      console.log('exception caught with command: ' + action + ', data: ' + data);
  }
  return 'OK';
}};

export default rpc;