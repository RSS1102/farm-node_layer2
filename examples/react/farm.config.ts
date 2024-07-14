export default (env: any) => {
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
