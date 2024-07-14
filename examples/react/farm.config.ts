export default (env) => {
  console.log(env);
  return {
    plugins: ["@farmfe/plugin-react"],
    server: {
      port: 6542,
      open: true,
    },
    compilation: {
      input: {},
      output: {},
    },
  };
};
