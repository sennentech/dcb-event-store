import { newDb } from "pg-mem"
import { Pool } from "pg"
import { PostgresCourseSubscriptionsRepository } from "../repository/PostgresCourseSubscriptionRespository"
import { Api } from "../Api"
import { EventSourcedApi } from "./EventSourcedApi"
import { MemoryEventStore } from "../../eventStore/memoryEventStore/MemoryEventStore"
import { CourseSubscriptionsProjection } from "./CourseSubscriptionsProjection"
import { ProjectionRegistry } from "../../eventHandling/EventHandler"
import { PostgresLockManager } from "../../eventHandling/LockManager"
import { getPgMemDb } from "../../eventStore/utils/getPgMemDb"

const COURSE_1 = {
    id: "course-1",
    capacity: 5
}

const STUDENT_1 = {
    id: "student-1",
    name: "Student 1"
}

describe("EventSourcedApi", () => {
    let pool: Pool
    let repository: PostgresCourseSubscriptionsRepository
    let api: Api

    beforeAll(async () => {
        pool = new (getPgMemDb().adapters.createPg().Pool)()
        repository = new PostgresCourseSubscriptionsRepository(pool)
        await repository.install()
    })

    describe("with one course and 100 students in database", () => {
        beforeAll(async () => {
            api = EventSourcedApi(new MemoryEventStore(), repository, [])
            api.registerCourse({ id: COURSE_1.id, capacity: COURSE_1.capacity })

            const studentRegistraionPromises = []
            for (let i = 0; i < 100; i++) {
                studentRegistraionPromises.push(api.registerStudent({ id: `student-${i}`, name: `Student ${i}` }))
            }
            await Promise.all(studentRegistraionPromises)
        })

        test("should throw error when 6th student subscribes", async () => {
            for (let i = 1; i <= 5; i++) {
                await api.subscribeStudentToCourse({ courseId: COURSE_1.id, studentId: `student-${i}` })
            }

            await expect(
                api.subscribeStudentToCourse({ courseId: COURSE_1.id, studentId: "student-6" })
            ).rejects.toThrow(`Course ${COURSE_1.id} is full.`)
        })

        test("should reject subscriptions when 10 students subscribe simultaneously", async () => {
            const studentSubscriptionPromises = []

            for (let i = 0; i < 10; i++) {
                studentSubscriptionPromises.push(
                    api.subscribeStudentToCourse({ courseId: COURSE_1.id, studentId: `student-${i}` })
                )
            }

            const results = await Promise.allSettled(studentSubscriptionPromises)
            const succeeded = results.filter(result => result.status === "fulfilled").length
            expect(succeeded).toBeLessThanOrEqual(COURSE_1.capacity)
        })
    })

    describe("with a course projection", () => {
        let lockManager: PostgresLockManager
        beforeAll(async () => {
            lockManager = new PostgresLockManager(pool, "course-subscriptions")
            await lockManager.install()
        })
        beforeEach(async () => {
            const projectionRegistry: ProjectionRegistry = [
                {
                    handler: CourseSubscriptionsProjection(lockManager),
                    lockManager
                }
            ]
            api = EventSourcedApi(new MemoryEventStore(), repository, projectionRegistry)
        })
        test("single course registered shows in repository", async () => {
            await api.registerCourse({ id: COURSE_1.id, capacity: COURSE_1.capacity })

            const course = await repository.findCourseById(COURSE_1.id)
            expect(course).toEqual({ id: COURSE_1.id, capacity: COURSE_1.capacity, subscribedStudents: [] })
        })

        test("single student registered shows in repository", async () => {
            await api.registerStudent({ id: STUDENT_1.id, name: STUDENT_1.name })

            const student = await repository.findStudentById(STUDENT_1.id)
            expect(student).toEqual({ id: STUDENT_1.id, name: STUDENT_1.name, subscribedCourses: [] })
        })

        test("student subscribed to course shows in repository", async () => {
            await api.registerCourse({ id: COURSE_1.id, capacity: COURSE_1.capacity })
            await api.registerStudent({ id: STUDENT_1.id, name: STUDENT_1.name })
            await api.subscribeStudentToCourse({ courseId: COURSE_1.id, studentId: STUDENT_1.id })

            const course = await repository.findCourseById(COURSE_1.id)
            const student = await repository.findStudentById(STUDENT_1.id)

            expect(course.subscribedStudents).toEqual([{ id: STUDENT_1.id, name: STUDENT_1.name }])
            expect(student.subscribedCourses).toEqual([{ id: COURSE_1.id, capacity: COURSE_1.capacity }])
        })
    })
})
