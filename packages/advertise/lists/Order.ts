import { list } from '@keystone-6/core'
import { utils } from '@mirrormedia/lilith-core'
import {
  text,
  select,
  relationship,
  checkbox,
  timestamp,
} from '@keystone-6/core/fields'

const { allowRoles, admin, moderator, editor } = utils.accessControl

const orderStateOptions = [
  { label: '待上傳素材', value: 'paid' },
  { label: '已上傳檔案', value: 'file_uploaded' },
  { label: '已確認素材', value: 'material_confirmed' },
  { label: '素材更新', value: 'material_updated' },
  { label: '已製作', value: 'produced' },
  { label: '影片確認', value: 'video_confirmed' },
  { label: '排播', value: 'scheduled' },
  { label: '已播出', value: 'broadcasted' },
  { label: '提出修改要求', value: 'modification_request' },
  { label: '待確認修改報價', value: 'pending_quote_confirmation' },
  { label: '已轉交', value: 'transferred' },
  { label: '待排播', value: 'pending_broadcast_date' },
  { label: '已取消', value: 'cancelled' },
]

const listConfigurations = list({
  hooks: {
    resolveInput: ({ resolvedData, operation, item }) => {
      if (operation === 'create' && !item && !resolvedData.updatedAt) {
        resolvedData.updatedAt = new Date()
      }

      if (resolvedData.relatedOrder) {
        const hasRelatedOrder =
          resolvedData.relatedOrder.connect?.id ||
          resolvedData.relatedOrder.connect

        if (hasRelatedOrder) {
          const currentState = resolvedData.state || item?.state
          if (currentState !== 'transferred') {
            resolvedData.state = 'transferred'
          }
        }
      }

      return resolvedData
    },
    validateInput: async ({
      resolvedData,
      addValidationError,
      item,
      context,
    }) => {
      const state = resolvedData.state || item?.state

      if (resolvedData.relatedOrder) {
        const relatedOrderId =
          resolvedData.relatedOrder.connect?.id ||
          resolvedData.relatedOrder.connect

        if (relatedOrderId && item?.id && relatedOrderId === item.id) {
          addValidationError('不能選擇自己作為訂單更動的目標')
          return
        }

        if (item?.relatedOrder && relatedOrderId) {
          addValidationError('此訂單已經轉移過，不能再次修改轉移目標')
          return
        }

        if (relatedOrderId) {
          const targetOrder = await context.query.Order.findOne({
            where: { id: relatedOrderId },
            query: 'id state relatedOrder { id }',
          })

          if (!targetOrder) {
            addValidationError('目標訂單不存在')
            return
          }

          if (targetOrder.relatedOrder) {
            addValidationError('不能選擇已經轉移出去的訂單作為訂單更動的目標')
            return
          }

          const ordersPointingToTarget = await context.query.Order.findMany({
            where: {
              relatedOrder: { id: { equals: relatedOrderId } },
            },
            query: 'id',
          })

          if (ordersPointingToTarget && ordersPointingToTarget.length > 0) {
            addValidationError(
              '此訂單已經被其他訂單轉移過來，不能再次被選為目標'
            )
            return
          }
        }
      }

      if (state === 'transferred') {
        let hasRelatedOrder = false

        if (resolvedData.relatedOrder) {
          hasRelatedOrder = !!(
            resolvedData.relatedOrder.connect?.id ||
            resolvedData.relatedOrder.connect
          )
        } else if (item?.relatedOrder) {
          hasRelatedOrder = !!item.relatedOrder
        }

        if (!hasRelatedOrder) {
          addValidationError('狀態為「已轉交」時，必須設定訂單更動')
        }
      }
    },
  },
  fields: {
    member: relationship({
      label: '會員',
      ref: 'Member.orders',
    }),
    orderNumber: text({
      label: '訂單編號',
      validation: {
        isRequired: true,
      },
      isIndexed: 'unique',
    }),
    name: text({
      label: '廣告名稱',
      validation: {
        isRequired: true,
        length: {
          max: 10,
        },
      },
    }),
    nameEditable: checkbox({
      label: '廣告名稱客戶可修改',
      defaultValue: false,
    }),
    state: select({
      label: '狀態',
      options: orderStateOptions,
      defaultValue: 'paid',
    }),
    relatedOrder: relationship({
      label: '訂單更動',
      ref: 'Order',
      ui: {
        hideCreate: true,
        displayMode: 'select',
      },
    }),
    paragraphOne: text({
      label: '第一段文字',
      ui: {
        displayMode: 'textarea',
      },
    }),
    paragraphOneEditable: checkbox({
      label: '客戶可修改第一段文字',
      defaultValue: false,
    }),
    paragraphTwo: text({
      label: '第二段文字',
      ui: {
        displayMode: 'textarea',
      },
    }),
    paragraphTwoEditable: checkbox({
      label: '客戶可修改第二段文字',
      defaultValue: false,
    }),
    image: relationship({
      label: '圖片素材',
      ref: 'Photo',
    }),
    imageEditable: checkbox({
      label: '客戶可修改圖片',
      defaultValue: false,
    }),
    demoImage: relationship({
      label: '影片截圖',
      ref: 'Photo',
      many: true,
    }),
    attachment: relationship({
      label: '相關文件',
      ref: 'Pdf',
    }),
    scheduleStartDate: timestamp({
      label: '排播開始日期',
      db: {
        isNullable: true,
      },
      validation: {
        isRequired: false,
      },
    }),
    scheduleEndDate: timestamp({
      label: '排播結束日期',
      db: {
        isNullable: true,
      },
      validation: {
        isRequired: false,
      },
    }),
    scheduleEditable: checkbox({
      label: '客戶可修改排播日期',
      defaultValue: false,
    }),
  },

  ui: {
    listView: {
      initialColumns: [
        'member',
        'orderNumber',
        'state',
        'scheduleStartDate',
        'scheduleEndDate',
      ],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
