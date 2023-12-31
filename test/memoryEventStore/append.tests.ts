import { expect } from "chai"
import { MemoryEventStore } from "../../src/eventStore/memoryEventStore/MemoryEventStore"
import { AppendCondition, AppendConditions } from "../../src/eventStore/EventStore"
import { TestEvent1 } from "./TestEvent"
import { SequenceNumber } from "../../src/eventStore/SequenceNumber"

describe("memoryEventStore.append", () => {
    describe("when event store empty", () => {
        it("append gives new sequence number of 1", async () => {
            const eventStore = new MemoryEventStore()
            const { lastSequenceNumber } = await eventStore.append(new TestEvent1("ev-1"), AppendConditions.None)

            expect(lastSequenceNumber.value).to.equal(1)
        })
    })

    describe("when event store has one event", () => {
        it("append gives new sequence number of 2", async () => {
            const eventStore = new MemoryEventStore()
            await eventStore.append(new TestEvent1("ev-1"), AppendConditions.None)

            const { lastSequenceNumber } = await eventStore.append(new TestEvent1("ev-2"), AppendConditions.None)

            expect(lastSequenceNumber.value).to.equal(2)
        })

        it("append 2 events in array gives new sequence number of 2", async () => {
            const eventStore = new MemoryEventStore()
            const { lastSequenceNumber } = await eventStore.append(
                [new TestEvent1("ev-1"), new TestEvent1("ev-2")],
                AppendConditions.None
            )

            expect(lastSequenceNumber.value).to.equal(2)
        })
    })

    describe("when append condition supplied", () => {
        it("simple condition no new events doesnt throw", async () => {
            const eventStore = new MemoryEventStore()
            const appendCondition: AppendCondition = {
                query: {
                    criteria: [{ eventTypes: ["testEvent1"], tags: {} }]
                },
                maxSequenceNumber: SequenceNumber.create(1)
            }
            const { lastSequenceNumber } = await eventStore.append(new TestEvent1("ev-1"), appendCondition)

            expect(lastSequenceNumber.value).to.equal(1)
        })

        it("higher sequence number than condition throws", async () => {
            const eventStore = new MemoryEventStore()
            const appendCondition: AppendCondition = {
                query: {
                    criteria: [{ eventTypes: ["testEvent1"], tags: {} }]
                },
                maxSequenceNumber: SequenceNumber.create(1)
            }
            await eventStore.append(new TestEvent1("ev-1"), AppendConditions.None)
            await eventStore.append(new TestEvent1("ev-1"), AppendConditions.None)

            await expect(eventStore.append(new TestEvent1("ev-2"), appendCondition)).to.be.rejectedWith(
                "Expected Version fail: New events matching appendCondition found."
            )
        })
    })
})
