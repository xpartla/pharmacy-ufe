# xpartla-pharmacy-order-list



<!-- Auto Generated Below -->


## Properties

| Property     | Attribute     | Description | Type                    | Default     |
| ------------ | ------------- | ----------- | ----------------------- | ----------- |
| `apiBase`    | `api-base`    |             | `string`                | `undefined` |
| `pharmacyId` | `pharmacy-id` |             | `string`                | `undefined` |
| `userRole`   | `user-role`   |             | `"lekaren" \| "sestra"` | `undefined` |


## Events

| Event           | Description | Type                  |
| --------------- | ----------- | --------------------- |
| `order-clicked` |             | `CustomEvent<string>` |


## Dependencies

### Used by

 - [xpartla-pharmacy-product-app](../xpartla-pharmacy-product-app)

### Graph
```mermaid
graph TD;
  xpartla-pharmacy-product-app --> xpartla-pharmacy-order-list
  style xpartla-pharmacy-order-list fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
